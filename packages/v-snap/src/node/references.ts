/**
 * Functions for the reference images on disk. They find the references,
 * and check that each one's pixels still match the hash it carries. They
 * also find and remove the references that no actual image was compared
 * with.
 *
 * Every reference image that this package writes carries the hash of its
 * pixels in a text chunk at the start of the file. That chunk is how the
 * package tells its reference images from any other PNG, such as a texture
 * that a test loads. So a PNG without it is never deleted, whatever folder
 * it is in.
 */

import { type Dirent, existsSync, globSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, posix, relative, resolve } from 'node:path';
import picomatch from 'picomatch';
import { matchReferenceName, resolveReferencePattern, STEM_SUFFIXES, toFileStem, type VisualLayout } from './layout.ts';
import { decodePng, hashImage, isLfsPointer, readPngHash } from './png.ts';
import { isSkippedFolder } from './test-files.ts';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Records a root of visual tests, which `vsnap` calls for each set of
 * projects that it makes. A scan of one root skips another root inside it,
 * because that folder's reference images belong to its own tests.
 */
export function registerRoot(root: string): void {
    roots.add(toFileKey(root));
}

/**
 * Returns every reference image of a layout's test files: every PNG that
 * carries a pixel hash, and that the reference path would give one of its
 * test files. Those are the files that its `include` globs match, so a test
 * file that was deleted still owns its images, which are then unused. A
 * template that doesn't name the test file, such as
 * `{testFileDir}/{imageName}.png`, gives each image to a folder instead, so
 * only a folder that holds one of `testFiles` has images. So a copy of a
 * reference in a docs folder, or an image of another `vsnap` call's tests,
 * is never one, and a run never deletes it. It skips installed packages,
 * build output and hidden folders, and any other root of visual tests
 * inside the layout's root.
 */
export function findReferences(layout: VisualLayout, testFiles: readonly string[]): { readonly file: string; readonly bytes: number }[] {
    const isOwn = createOwnership(layout, testFiles);
    const entries = globSync(toReferenceGlob(layout.referencePath), {
        cwd: layout.root,
        withFileTypes: true,
        exclude: (entry: Dirent) => entry.isDirectory() && (isSkippedFolder(entry.name) || roots.has(toFileKey(join(entry.parentPath, entry.name)))),
    });
    const found: { file: string; bytes: number }[] = [];
    for (const entry of entries) {
        const path = join(entry.parentPath, entry.name);
        if (entry.isFile() && isOwn(relative(layout.root, path).replaceAll('\\', '/')) && readPngHash(path) !== undefined) {
            found.push({ file: path, bytes: statSync(path).size });
        }
    }
    return found.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

/**
 * Returns the glob that matches every path that a reference path template
 * can produce. A folder variable matches any folders, and a name variable
 * matches any one name.
 */
export function toReferenceGlob(template: string): string {
    return template
        .replaceAll('{testFileDir}', '**')
        .replaceAll('{testFilePath}', '**')
        .replaceAll('{testFileName}', '*')
        .replaceAll('{testFileStem}', '*')
        .replaceAll('{imageName}', '*');
}

/**
 * Returns the PNGs that a test file's references could be, by its layout's
 * reference path, whether or not they carry a hash. With `findReferences`,
 * this finds a reference that lost its hash, such as one that a paint
 * program saved.
 */
export function findReferenceCandidates(layout: VisualLayout, testFile: string): string[] {
    const pattern = resolveReferencePattern(layout, testFile);
    if (!existsSync(pattern.dir)) return [];
    const found: string[] = [];
    for (const name of readdirSync(pattern.dir)) {
        if (matchReferenceName(pattern, name) !== undefined) found.push(join(pattern.dir, name));
    }
    return found;
}

/**
 * Returns the PNGs that some test files' references could be, as
 * `findReferenceCandidates` does for each, whether or not they carry a
 * hash. A PNG that one of `others` could also have, such as one in a folder
 * that two test files share, is left out, since which file it belongs to
 * can't be told. A run that ran only some files checks only theirs.
 */
export function findCandidatesOfFiles(layout: VisualLayout, files: readonly string[], others: readonly string[]): string[] {
    const otherPatterns = others.map((file) => resolveReferencePattern(layout, file));
    const found = new Map<string, string>();
    for (const file of files) {
        for (const candidate of findReferenceCandidates(layout, file)) {
            const dir = toFileKey(dirname(candidate));
            const name = basename(candidate);
            if (otherPatterns.some((p) => toFileKey(p.dir) === dir && matchReferenceName(p, name) !== undefined)) continue;
            found.set(toFileKey(candidate), candidate);
        }
    }
    return [...found.values()].sort();
}

/** Returns the reference images of some test files: their candidates (see `findCandidatesOfFiles`) that carry a pixel hash, with their sizes. */
export function findReferencesOfFiles(layout: VisualLayout, files: readonly string[], others: readonly string[]): { readonly file: string; readonly bytes: number }[] {
    const found: { file: string; bytes: number }[] = [];
    for (const file of findCandidatesOfFiles(layout, files, others)) {
        if (readPngHash(file) !== undefined) found.push({ file, bytes: statSync(file).size });
    }
    return found;
}

/**
 * Returns what is wrong with a reference file, or undefined if nothing is.
 * A visual run trusts the hash a reference carries, without decoding the
 * file. So a file whose pixels were edited, or that carries no hash, would
 * pass the run unnoticed.
 */
export function checkReference(file: string): string | undefined {
    const bytes = readFileSync(file);
    if (isLfsPointer(bytes)) return LFS_PROBLEM;
    const stored = readPngHash(file);
    if (stored === undefined) return 'carries no pixel hash, so the visual tests did not write it';
    let actual: string;
    try {
        actual = hashImage(decodePng(bytes));
    }
    catch (error) {
        return `cannot be decoded (${error instanceof Error ? error.message : String(error)})`;
    }
    return actual === stored ? undefined : `its pixels hash to ${actual}, but the hash it carries is ${stored}`;
}

/** What `checkReference` returns for a Git LFS pointer file, which a checkout without Git LFS leaves in place of an image. */
export const LFS_PROBLEM = 'is a Git LFS pointer, not an image';

/**
 * Returns the references, of those given, that no actual image was
 * compared with. After a full run, in which every test ran, these are the
 * files of tests that were renamed or deleted.
 */
export function findOrphans(options: { readonly references: readonly string[]; readonly compared: Iterable<string> }): string[] {
    const compared = new Set<string>();
    for (const file of options.compared) compared.add(toFileKey(file));
    return options.references.filter((file) => !compared.has(toFileKey(file)));
}

/**
 * Checks references as `checkReference` does, and returns each one's
 * problem, if it has one. A reference that passed before, and has the same
 * size and modification time, isn't decoded again: a cache file remembers
 * the references that passed. An edit of a reference changes its time, so
 * it is checked again.
 */
export function checkReferences(files: readonly string[], cacheFile: string): Map<string, string | undefined> {
    const cache = readCheckCache(cacheFile);
    const passed: Record<string, string> = {};
    const results = new Map<string, string | undefined>();
    for (const file of files) {
        const key = toFileKey(file);
        let stamp: string | undefined;
        try {
            const stats = statSync(file);
            stamp = `${stats.size}:${stats.mtimeMs}`;
        }
        catch {
            stamp = undefined;
        }
        const problem = stamp !== undefined && cache[key] === stamp ? undefined : checkReference(file);
        results.set(file, problem);
        if (problem === undefined && stamp !== undefined) passed[key] = stamp;
    }
    try {
        mkdirSync(dirname(cacheFile), { recursive: true });
        writeFileSync(cacheFile, JSON.stringify({ version: CHECK_CACHE_VERSION, passed: { ...cache, ...passed } }));
    }
    catch {
        // The cache only saves time. Without it, the next run decodes again.
    }
    return results;
}

/**
 * Deletes a reference. Then it deletes each folder above the reference
 * that is left empty, up to the project's root.
 */
export function removeReference(file: string, root: string): void {
    rmSync(file);
    const top = toFileKey(root);
    for (let dir = dirname(file); toFileKey(dir) !== top && toFileKey(dir).startsWith(top); dir = dirname(dir)) {
        if (readdirSync(dir).length > 0) return;
        rmdirSync(dir);
    }
}

/**
 * Returns a path in a form that can be compared. The path is resolved. On
 * Windows and macOS, where paths ignore case, it is also lower-cased. On
 * Windows, Vitest writes paths as `V:/...` and Node writes them as `v:\...`.
 * On both, a reference named in another case than its test's image is the
 * same file, which must not look unused, and so be deleted.
 */
export function toFileKey(file: string): string {
    const resolved = resolve(file);
    return process.platform === 'win32' || process.platform === 'darwin' ? resolved.toLowerCase() : resolved;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The roots of visual tests that this process's config made. */
const roots = new Set<string>();

/** The version of the check cache's contents. A change to how references are checked or hashed changes it, so that every reference is checked again. */
const CHECK_CACHE_VERSION = 1;

/** Returns the references that passed their checks before, by file key, with each one's size and time, or none if the cache is missing or old. */
function readCheckCache(cacheFile: string): Record<string, string> {
    try {
        const cache = JSON.parse(readFileSync(cacheFile, 'utf8')) as { version?: number; passed?: Record<string, string> };
        return cache.version === CHECK_CACHE_VERSION && cache.passed !== undefined ? cache.passed : {};
    }
    catch {
        return {};
    }
}

/**
 * Returns a test of whether an image, by its path relative to the root,
 * belongs to one of a layout's test files. It reads the reference path
 * template backwards, to find the test file, or its folder, that would put
 * an image there.
 */
function createOwnership(layout: VisualLayout, testFiles: readonly string[]): (path: string) => boolean {
    const template = layout.referencePath;
    const isMatched = picomatch([...layout.include], { dot: false });
    const isExcluded = layout.exclude.length === 0 ? () => false : picomatch([...layout.exclude]);
    const isIncluded = (file: string): boolean => isMatched(file) && !isExcluded(file);
    const files = testFiles.map((file) => relative(layout.root, resolve(layout.root, file)).replaceAll('\\', '/'));
    const folders = new Set(files.map((file) => posix.dirname(file)));
    const names = new Set(files.map((file) => posix.basename(file)));
    const stems = new Set(files.map((file) => `${posix.dirname(file)}/${toFileStem(posix.basename(file))}`));
    const parse = toTemplateRegExp(template);
    // A stem and an image name can both hold dots, so where one ends can't
    // be told from the path alone. Each test file's own pattern settles it.
    const patterns = template.includes('{testFileStem}') ? testFiles.map((file) => resolveReferencePattern(layout, resolve(layout.root, file))) : [];
    return (path) => {
        const absolute = resolve(layout.root, path);
        if (patterns.some((p) => toFileKey(p.dir) === toFileKey(dirname(absolute)) && matchReferenceName(p, basename(absolute)) !== undefined)) return true;
        const match = parse.exec(path);
        if (match === null) return false;
        const { dir = '.', name, stem, file } = match.groups ?? {};
        if (file !== undefined) return isIncluded(file);
        if (stem !== undefined) {
            // A test file that was deleted still owns its images, if a name
            // that the stem could have had matches the globs.
            const prefix = template.includes('{testFileDir}') && dir !== '.' ? `${dir}/` : '';
            return stems.has(`${dir}/${stem}`) || STEM_SUFFIXES.some((suffix) => isIncluded(`${prefix}${stem}${suffix}`));
        }
        if (name !== undefined && template.includes('{testFileDir}')) return isIncluded(dir === '.' ? name : `${dir}/${name}`);
        if (name !== undefined) return names.has(name);
        if (template.includes('{testFileDir}')) return folders.has(dir);
        // A template with no variable but the image name puts every image in
        // one folder, which belongs to every test file.
        return true;
    };
}

/**
 * Returns a regular expression that matches the paths that a reference path
 * template gives, with the groups `dir`, `name` and `file` for the template's
 * variables. A `{testFileDir}/` at the start is optional, since a test file
 * at the root has none.
 */
function toTemplateRegExp(template: string): RegExp {
    const seen = new Set<string>();
    let source = '';
    for (const part of template.split(/(\{[^}]+\}\/?)/)) {
        const variable = /^\{([^}]+)\}(\/?)$/.exec(part);
        if (variable === null) {
            source += part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            continue;
        }
        const [, name, slash] = variable;
        const group = GROUPS[name];
        if (group === undefined) {
            source += `[^/]+${slash}`;
            continue;
        }
        const isRepeat = seen.has(group.name);
        seen.add(group.name);
        const capture = isRepeat ? `\\k<${group.name}>` : `(?<${group.name}>${group.pattern})`;
        source += name === 'testFileDir' && slash === '/' && source === '' ? `(?:${capture}/)?` : `${capture}${slash}`;
    }
    return new RegExp(`^${source}$`);
}

/** The groups that the template's variables give, other than `{imageName}`, which matches any one name. */
const GROUPS: Readonly<Record<string, { readonly name: string; readonly pattern: string }>> = {
    testFileDir: { name: 'dir', pattern: '.+?' },
    testFileName: { name: 'name', pattern: '[^/]+' },
    testFileStem: { name: 'stem', pattern: '[^/]+?' },
    testFilePath: { name: 'file', pattern: '.+' },
};
