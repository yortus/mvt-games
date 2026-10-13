import { type Dirent, globSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import picomatch from 'picomatch';
import type { PageKind } from '../protocol.ts';
import { toFileStem, type VisualLayout } from './layout.ts';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A project's visual test files, by kind, as paths relative to its root,
 * with forward slashes, as Vitest's `include` takes them.
 */
export interface VisualTestFiles {
    readonly canvas: readonly string[];
    readonly html: readonly string[];
    /**
     * The files that match the globs but can't run, each with what is wrong
     * with it. vsnap leaves them out of its projects, and reports them, so
     * that one half-written file stops no other test.
     */
    readonly problems: readonly { readonly file: string; readonly problem: string }[];
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Finds a project's visual test files, which are the files that match its
 * `include` globs, and sorts them by the kind of test that they declare.
 * Canvas tests and HTML tests run in different kinds of page, so each file
 * goes to the Vitest project for its kind. Vitest gives each project its
 * files before any test code runs, so the declarations are read from each
 * file's text. A file that declares both kinds, or neither, or is outside
 * the project's root, is a problem, not a test file.
 */
export function findVisualTestFiles(layout: VisualLayout): VisualTestFiles {
    const files: Record<PageKind, string[]> = { canvas: [], html: [] };
    const problems: { file: string; problem: string }[] = [];
    for (const file of listTestFiles(layout)) {
        if (file.startsWith('../')) {
            problems.push({ file, problem: "matches the visual test files' globs (include), but it is outside the project's root" });
            continue;
        }
        let text: string;
        try {
            text = readFileSync(join(layout.root, file), 'utf8');
        }
        catch {
            // Deleted since the glob found it.
            continue;
        }
        const isCanvas = CANVAS_DECLARATION.test(text);
        const isHtml = HTML_DECLARATION.test(text);
        if (isCanvas && isHtml) {
            problems.push({ file, problem: 'declares both canvas and HTML visual tests. The two kinds run in different pages, so split them into two files' });
        }
        else if (!isCanvas && !isHtml) {
            problems.push({ file, problem: "matches the visual test files' globs (include), but it declares no canvasTest or htmlTest yet" });
        }
        else {
            const twin = findStemTwin(layout, file, [...files.canvas, ...files.html]);
            if (twin === undefined) files[isHtml ? 'html' : 'canvas'].push(file);
            else problems.push({ file, problem: `has the same stem as ${twin}, so the two would share their reference images. Rename one` });
        }
    }
    return { ...files, problems };
}

/** Returns a message that lists the visual test files that can't run, and why. */
export function describeProblems(problems: VisualTestFiles['problems']): string {
    const lines = problems.map((p) => `  ${p.file} ${p.problem}.`);
    return `${problems.length === 1 ? 'A file matches' : `${problems.length} files match`} the visual test files' globs but can't run, so vsnap left ${problems.length === 1 ? 'it' : 'them'} out:\n${lines.join('\n')}`;
}

/**
 * Returns a path as a glob that matches only that path. Vitest's `include`
 * and Vite's dependency scan read their entries as globs, so a test file in
 * a folder such as `[slug]` or `(auth)` would otherwise match nothing.
 */
export function escapeGlob(path: string): string {
    return path.replace(/[\\*?[\]{}()!+@]/g, '\\$&');
}

/**
 * Records the names of a `vsnap` call's projects, and returns every name that
 * this process's calls recorded. Vitest loads its config several times in a
 * run, each time with a fresh copy of this module, so the names are kept on
 * the process.
 */
export function recordVsnapProjectNames(names: readonly string[]): void {
    for (const name of names) listVsnapProjectNames().add(name);
}

/** Returns the names of every project that a `vsnap` call made in this process. */
export function listVsnapProjectNames(): Set<string> {
    return ((globalThis as { vsnapProjectNames?: Set<string> }).vsnapProjectNames ??= new Set());
}

/** Returns whether a folder holds no visual test files or reference images: installed packages, build output, and hidden folders such as `.git`. */
export function isSkippedFolder(name: string): boolean {
    return name === 'node_modules' || name === 'dist' || name.startsWith('.');
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// A test is declared by a call, or by `.skipIf(x)(` and `.runIf(x)(`, whose
// condition comes first.
const CANVAS_DECLARATION = /\bcanvasTest(\.(skip|only|todo|each|for))?\s*\(|\bcanvasTest\.(skipIf|runIf)\s*\(/;
const HTML_DECLARATION = /\bhtmlTest(\.(skip|only|todo|each|for))?\s*\(|\bhtmlTest\.(skipIf|runIf)\s*\(/;

/**
 * Returns a test file that has the same folder and stem as a file, such as
 * `hud-view.test.ts` for `hud-view.test.tsx`, if the reference path names
 * images by the stem. Otherwise, or if there is none, it returns undefined.
 */
function findStemTwin(layout: VisualLayout, file: string, others: readonly string[]): string | undefined {
    if (!layout.referencePath.includes('{testFileStem}')) return undefined;
    const key = toStemKey(file);
    return others.find((other) => toStemKey(other) === key);
}

/** Returns a file's folder and stem, for comparing two files. */
function toStemKey(file: string): string {
    const slash = file.lastIndexOf('/');
    return `${file.slice(0, slash + 1)}${toFileStem(file.slice(slash + 1))}`.toLowerCase();
}

/** Returns the files that match the layout's globs, sorted, relative to the root, with forward slashes. */
function listTestFiles(layout: VisualLayout): string[] {
    const found = new Set<string>();
    // A glob can match a folder as well as a file, such as a reference
    // folder named after its test file. So only files are kept.
    const entries = globSync([...layout.include], {
        cwd: layout.root,
        withFileTypes: true,
        exclude: (entry: Dirent) => entry.isDirectory() && isSkippedFolder(entry.name),
    });
    const isExcluded = picomatch([...layout.exclude]);
    for (const entry of entries) {
        if (!entry.isFile()) continue;
        const file = relative(layout.root, join(entry.parentPath, entry.name)).replaceAll('\\', '/');
        if (layout.exclude.length === 0 || !isExcluded(file)) found.add(file);
    }
    return [...found].sort();
}
