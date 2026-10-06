/**
 * Facts about each entry measured from its source: its size and the renderers
 * it draws with. An entry is a directory under `src/entries/`, named for the
 * entry's id.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type RendererKind = 'pixi' | 'three' | 'html';

export interface EntryFacts {
    /** Lines in the entry's source files, tests left out. */
    readonly lines: number;
    /** Its source files, tests left out. */
    readonly files: number;
    /** The renderers its source imports, in a fixed order. */
    readonly renderers: readonly RendererKind[];
    /** Its directory, from the repo's root, with forward slashes (`packages/website/src/entries/crumb-chase`). */
    readonly sourcePath: string;
}

/** The directory under `src/` that holds the entries, one directory each. */
export const ENTRIES_DIR = 'entries';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Measures every entry under `srcDir`, by id. */
export function readEntryFacts(options: { srcDir: string; repoDir: string }): Record<string, EntryFacts> {
    const { srcDir, repoDir } = options;
    const facts: Record<string, EntryFacts> = {};
    const entriesDir = join(srcDir, ENTRIES_DIR);
    for (const id of readdirSync(entriesDir).sort()) {
        const entryDir = join(entriesDir, id);
        if (isDirectory(entryDir)) facts[id] = measure(entryDir, repoDir);
    }
    return facts;
}

/** Every entry directory under `srcDir`, by id. */
export function findEntryDirectories(srcDir: string): Record<string, string> {
    const dirs: Record<string, string> = {};
    const entriesDir = join(srcDir, ENTRIES_DIR);
    for (const id of readdirSync(entriesDir)) {
        if (isDirectory(join(entriesDir, id))) dirs[id] = join(entriesDir, id);
    }
    return dirs;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Which imports mean which renderer. A library's own package counts with the library. */
const RENDERER_IMPORTS: readonly (readonly [RendererKind, RegExp])[] = [
    ['pixi', /from\s+['"](pixi\.js|@mvtjs\/pixi)(\/[^'"]*)?['"]|@jsxImportSource\s+@mvtjs\/pixi/],
    ['three', /from\s+['"](three|@mvtjs\/three)(\/[^'"]*)?['"]|@jsxImportSource\s+@mvtjs\/three/],
    ['html', /from\s+['"]@mvtjs\/html(\/[^'"]*)?['"]|@jsxImportSource\s+@mvtjs\/html/],
];

function measure(entryDir: string, repoDir: string): EntryFacts {
    let lines = 0;
    let files = 0;
    const found = new Set<RendererKind>();
    for (const file of sourceFiles(entryDir)) {
        const text = readFileSync(file, 'utf8');
        files++;
        lines += text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
        for (const [renderer, pattern] of RENDERER_IMPORTS) {
            if (pattern.test(text)) found.add(renderer);
        }
    }
    const renderers = RENDERER_IMPORTS.map(([renderer]) => renderer).filter((r) => found.has(r));
    return { lines, files, renderers, sourcePath: relative(repoDir, entryDir).replaceAll('\\', '/') };
}

function sourceFiles(dir: string): string[] {
    const found: string[] = [];
    for (const name of readdirSync(dir).sort()) {
        const path = join(dir, name);
        if (isDirectory(path)) found.push(...sourceFiles(path));
        else if ((extname(name) === '.ts' || extname(name) === '.tsx') && !/\.(test|spike)\.tsx?$/.test(name)) found.push(path);
    }
    return found;
}

function isDirectory(path: string): boolean {
    try {
        return statSync(path).isDirectory();
    }
    catch {
        return false;
    }
}
