import { type Dirent, globSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { VisualKind } from '../protocol.ts';
import type { VisualLayout } from './layout.ts';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Finds a project's visual test files, which are the files that match its
 * `include` globs, and sorts them by the kind of test that they declare.
 * Canvas tests and HTML tests run in different kinds of page, so each file
 * goes to the Vitest project for its kind. Vitest gives each project its
 * files before any test code runs, so the declarations are read from each
 * file's text. Throws if a file declares both kinds, or neither, or is
 * outside the project's root. Returns paths relative to the root, with
 * forward slashes, as Vitest's `include` takes them.
 */
export function findVisualTestFiles(layout: VisualLayout): Readonly<Record<VisualKind, readonly string[]>> {
    const files: Record<VisualKind, string[]> = { canvas: [], html: [] };
    for (const path of listTestFiles(layout)) {
        if (path.startsWith('../')) {
            throw new Error(`${path} matches the visual test files' globs (include), but it is outside the project's root.`);
        }
        const text = readFileSync(join(layout.root, path), 'utf8');
        const isCanvas = CANVAS_DECLARATION.test(text);
        const isHtml = HTML_DECLARATION.test(text);
        if (isCanvas && isHtml) {
            throw new Error(`${path} declares both canvas and HTML visual tests. The two kinds run in different pages, so split them into two files.`);
        }
        if (!isCanvas && !isHtml) {
            throw new Error(`${path} matches the visual test files' globs (include), but it declares no canvasTest or htmlTest.`);
        }
        files[isHtml ? 'html' : 'canvas'].push(path);
    }
    return files;
}

/**
 * Returns a path as a glob that matches only that path. Vitest's `include`
 * and Vite's dependency scan read their entries as globs, so a test file in
 * a folder such as `[slug]` or `(auth)` would otherwise match nothing.
 */
export function escapeGlob(path: string): string {
    return path.replace(/[\\*?[\]{}()!+@]/g, '\\$&');
}

/** Returns whether a folder holds no visual test files or reference images: installed packages, build output, and hidden folders such as `.git`. */
export function isSkippedFolder(name: string): boolean {
    return name === 'node_modules' || name === 'dist' || name.startsWith('.');
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CANVAS_DECLARATION = /\bcanvasTest(\.(skip|only|todo))?\s*\(/;
const HTML_DECLARATION = /\bhtmlTest(\.(skip|only|todo))?\s*\(/;

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
    for (const entry of entries) {
        if (entry.isFile()) found.add(relative(layout.root, join(entry.parentPath, entry.name)).replaceAll('\\', '/'));
    }
    return [...found].sort();
}
