// Measures the site's home page, the Arcade: the JavaScript it needs before
// its first paint, which must not include a renderer (Pixi or three.js), and
// must stay under a budget, gzipped. The Arcade shows cards, not entries: an
// entry's code, and the renderer it draws with, load only once it is
// launched, as dynamic imports, and its long text just after the first
// paint. So does anything few visitors open, such as the Perfmon. A static
// import of one, from anywhere the home page reaches, would bring it into the
// first load unnoticed, and the page would take longer to appear.
//
// It builds the Arcade in memory, as it is deployed, with its own Vite
// config, and walks the home page's chunks from its entry through their
// static imports, which the browser loads before the page runs. Dynamic
// imports are left out: they load later, on demand. A test runs it with the
// other tests (`home-page-budget.test.ts`), and `npm run build:arcade` runs
// it after building (`home-page-budget.ts`).

import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The most JavaScript the home page may load before its first paint, gzipped,
 * in bytes. On a midrange phone, each 10 KB more is roughly 30 ms more before
 * the wall shows, so it is a tripwire: going over says something new is on
 * the first load, which may belong in a dynamic import.
 */
export const HOME_PAGE_BUDGET_BYTES = 60 * 1024;

/** What the home page loads before its first paint, and what is wrong with it, if anything. */
export interface HomePageLoad {
    /** Each chunk loaded before the first paint, by file name, with its size gzipped, in bytes. */
    readonly chunks: readonly { readonly name: string; readonly gzippedBytes: number }[];
    /** All of them together, gzipped, in bytes. */
    readonly totalBytes: number;
    /** What breaks the rules: a renderer in a chunk, or a total over the budget. Empty when all is well. */
    readonly problems: readonly string[];
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Builds the Arcade in memory, and measures its home page's first load. */
export async function measureHomePageLoad(): Promise<HomePageLoad> {
    // A test runner sets NODE_ENV to `test`, and Vite would then build as for
    // development, keeping code a deploy leaves out: measured so, the first
    // load is a few KB heavier than the one visitors get. So it builds for
    // production, whatever runs it, and puts NODE_ENV back after
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    let output: Awaited<ReturnType<typeof build>>;
    try {
        output = await build({
            configFile: ARCADE_ROOT + 'vite.config.ts',
            mode: 'production',
            // How `vite build` loads it too, without the warning about the native loader
            configLoader: 'bundle',
            logLevel: 'error',
            build: { write: false },
        });
    }
    finally {
        if (nodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = nodeEnv;
    }
    const built = (Array.isArray(output) ? output : [output]).flatMap((o) => ('output' in o ? o.output : []));
    const byName = new Map(built.filter((c) => c.type === 'chunk').map((c) => [c.fileName, c]));

    const entry = [...byName.values()].find((c) => c.isEntry && c.facadeModuleId !== null && normalise(c.facadeModuleId) === normalise(HOME_PAGE));
    if (entry === undefined) throw new Error('home page load: found no chunk for the home page\'s entry');

    // The home page's first load: its entry chunk and everything it imports statically
    const loaded = new Set<string>();
    const queue = [entry.fileName];
    while (queue.length > 0) {
        const name = queue.pop()!;
        if (loaded.has(name)) continue;
        loaded.add(name);
        const chunk = byName.get(name);
        if (chunk === undefined) throw new Error(`home page load: the home page imports ${name}, which the build did not make`);
        queue.push(...chunk.imports);
    }

    const problems: string[] = [];
    const chunks: { name: string; gzippedBytes: number }[] = [];
    let totalBytes = 0;
    for (const name of [...loaded].sort()) {
        const chunk = byName.get(name)!;
        const gzippedBytes = gzipSync(chunk.code).length;
        chunks.push({ name, gzippedBytes });
        totalBytes += gzippedBytes;
        for (const forbidden of FORBIDDEN) {
            const count = chunk.moduleIds.filter((id) => normalise(id).includes(forbidden.path)).length;
            if (count > 0) problems.push(`${name} includes ${forbidden.name} (${count} modules)`);
        }
    }
    if (totalBytes > HOME_PAGE_BUDGET_BYTES) {
        problems.push(`its JavaScript is ${toKb(totalBytes)} KB gzipped, over the budget of ${toKb(HOME_PAGE_BUDGET_BYTES, 0)} KB`);
    }
    return { chunks, totalBytes, problems };
}

/** Describes the home page's first load, chunk by chunk, and what is wrong with it, if anything, with what to do. */
export function describeHomePageLoad(load: HomePageLoad): string {
    const lines = ['The home page\'s first load, gzipped:'];
    for (const chunk of load.chunks) lines.push(`  ${toKb(chunk.gzippedBytes).padStart(6)} KB  ${chunk.name}`);
    lines.push(`  ${toKb(load.totalBytes).padStart(6)} KB  in all, of a budget of ${toKb(HOME_PAGE_BUDGET_BYTES, 0)} KB`);
    if (load.problems.length === 0) {
        lines.push('', 'The home page\'s first load is within its budget, with no renderer in it.');
    }
    else {
        lines.push('', 'The home page\'s first load is too heavy:', ...load.problems.map((p) => `  - ${p}`));
        lines.push('', 'Load renderers, entry code, and anything few visitors open, with a dynamic import(), when it is needed.');
    }
    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ARCADE_ROOT = fileURLToPath(new URL('../../../sites/arcade/', import.meta.url));
/** The site's root page only sends the visitor on to the Arcade's, which is the one to measure. */
const HOME_PAGE = ARCADE_ROOT + 'arcade/index.html';

/** Packages the home page's first load must not include, and how their modules' paths show them. */
const FORBIDDEN: readonly { readonly name: string; readonly path: string }[] = [
    { name: 'pixi.js', path: '/node_modules/pixi.js/' },
    { name: 'three', path: '/node_modules/three/' },
    { name: '@mvtjs/pixi', path: '/packages/libraries/pixi/' },
    { name: '@mvtjs/three', path: '/packages/libraries/three/' },
];

function toKb(bytes: number, digits = 1): string {
    return (bytes / 1024).toFixed(digits);
}

/** A path with forward slashes, its drive letter in lower case, for comparing paths on any system. */
function normalise(path: string): string {
    return path.replaceAll('\\', '/').replace(/^[A-Z]:/, (drive) => drive.toLowerCase());
}
