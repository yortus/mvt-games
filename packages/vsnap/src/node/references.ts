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

import { existsSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { matchReferenceName, resolveReferencePattern, type VisualLayout } from './layout.ts';
import { decodePng, hashImage, readPngHash } from './png.ts';
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
 * Returns every reference image under a root, which means every PNG that
 * carries a pixel hash. It skips installed packages, build output and
 * hidden folders. It also skips any other root of visual tests inside it.
 */
export function findReferences(root: string): { readonly file: string; readonly bytes: number }[] {
    return find(root, true);
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
 * Returns what is wrong with a reference file, or undefined if nothing is.
 * A visual run trusts the hash a reference carries, without decoding the
 * file. So a file whose pixels were edited, or that carries no hash, would
 * pass the run unnoticed.
 */
export function checkReference(file: string): string | undefined {
    const stored = readPngHash(file);
    if (stored === undefined) return 'carries no pixel hash, so the visual tests did not write it';
    let actual: string;
    try {
        actual = hashImage(decodePng(readFileSync(file)));
    }
    catch (error) {
        return `cannot be decoded (${error instanceof Error ? error.message : String(error)})`;
    }
    return actual === stored ? undefined : `its pixels hash to ${actual}, but the hash it carries is ${stored}`;
}

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
 * Windows, where paths ignore case, it is also lower-cased, because Vitest
 * writes paths as `V:/...` and Node writes them as `v:\...`.
 */
export function toFileKey(file: string): string {
    const resolved = resolve(file);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The roots of visual tests that this process's config made. */
const roots = new Set<string>();

function find(dir: string, isRoot: boolean): { file: string; bytes: number }[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    if (!isRoot && roots.has(toFileKey(dir))) return [];
    const found: { file: string; bytes: number }[] = [];
    for (const entry of entries) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!isSkippedFolder(entry.name)) found.push(...find(path, false));
        }
        else if (entry.name.endsWith('.png') && readPngHash(path) !== undefined) found.push({ file: path, bytes: statSync(path).size });
    }
    return found;
}
