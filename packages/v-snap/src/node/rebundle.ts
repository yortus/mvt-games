/**
 * Decides whether Vite must bundle the tests' libraries afresh, before a
 * run. Every file of a kind runs in one page, so Vite must bundle every
 * library that the tests import before the run starts. A cache from an
 * earlier run would skip the scan of the tests' imports, and miss a library
 * that a test has started to import since. Vite would then find it during
 * the run, bundle again and reload the page, and the files after that point
 * would load a second copy of a library such as Pixi.
 *
 * So the cache is used only when no source file has changed since the run
 * that made it: an unchanged tree can't have gained an import. A
 * fingerprint of the repository's source files, by their paths, sizes and
 * times, tells. Vite itself bundles afresh when the lockfile or the config
 * changes. The fingerprint is recorded only by a run that runs v-snap's
 * projects, since only that run bundles.
 */

import { createHash } from 'node:crypto';
import { type Dirent, existsSync, globSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUT_DIR, REPO_ROOT } from './paths.ts';
import { toFileKey } from './references.ts';
import { isSkippedFolder } from './test-files.ts';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A `vsnap` call, by its name and its root. Each has a cache of bundled
 * libraries of its own, so each has a fingerprint of its own, even when
 * two configs' calls share a name.
 */
export interface VsnapCall {
    readonly name: string;
    readonly root: string;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns whether the projects of a `vsnap` call must bundle their
 * libraries afresh: whether the sources have changed since the last run
 * that bundled them. Within one process, the answer for unchanged sources
 * stays the same, since Vitest loads its config several times in a run.
 */
export function mustRebundle(call: VsnapCall): boolean {
    const fingerprint = findFingerprint();
    const file = fingerprintFile(call);
    const known = memory().decisions.get(file);
    if (known !== undefined && known.fingerprint === fingerprint) return known.mustRebundle;
    const recorded = known === undefined && existsSync(file) ? readFileSync(file, 'utf8') : undefined;
    const decision = { fingerprint, mustRebundle: recorded !== fingerprint };
    memory().decisions.set(file, decision);
    return decision.mustRebundle;
}

/** Records the sources' fingerprint for a `vsnap` call whose projects are about to run, and so to bundle. */
export function recordFingerprint(call: VsnapCall): void {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(fingerprintFile(call), findFingerprint());
}

/** Forgets the fingerprint, after a source file changed in watch mode, so that the next decision reads the sources again. */
export function forgetFingerprint(): void {
    memory().fingerprint = undefined;
}

/**
 * Returns a fingerprint of the source files under a folder: their paths,
 * sizes and modification times. It skips installed packages, build output
 * and hidden folders.
 */
export function fingerprintSources(root: string): string {
    const entries = globSync(`**/*.{${SOURCE_EXTENSIONS}}`, {
        cwd: root,
        withFileTypes: true,
        // A coverage report holds scripts, which every run with coverage rewrites.
        exclude: (entry: Dirent) => entry.isDirectory() && (isSkippedFolder(entry.name) || entry.name === 'coverage'),
    });
    const files = entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name)).sort();
    const hash = createHash('sha256');
    for (const file of files) {
        const stats = statSync(file);
        hash.update(`${file}\0${stats.size}\0${stats.mtimeMs}\n`);
    }
    return hash.digest('hex');
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The extensions of the files that can import a library. */
const SOURCE_EXTENSIONS = 'ts,tsx,mts,cts,js,jsx,mjs,cjs,vue,svelte';

interface Memory {
    /** The sources' fingerprint, read once in a process until a source changes. */
    fingerprint: string | undefined;
    /** Each `vsnap` call's decision, by its fingerprint file, with the fingerprint it was made for. */
    readonly decisions: Map<string, { readonly fingerprint: string; readonly mustRebundle: boolean }>;
}

/**
 * Returns the process's memory of fingerprints and decisions. Vitest loads
 * its config several times in a run, each time with a fresh copy of this
 * module, so the memory is kept on the process.
 */
function memory(): Memory {
    const process = globalThis as { vsnapRebundle?: Memory };
    process.vsnapRebundle ??= { fingerprint: undefined, decisions: new Map() };
    return process.vsnapRebundle;
}

function findFingerprint(): string {
    const remembered = memory();
    remembered.fingerprint ??= fingerprintSources(REPO_ROOT);
    return remembered.fingerprint;
}

/** Returns the file that holds a call's fingerprint, named for the call and a hash of its root. */
function fingerprintFile(call: VsnapCall): string {
    const root = createHash('sha256').update(toFileKey(call.root)).digest('hex').slice(0, 8);
    return join(OUT_DIR, `${call.name}-${root}.sources-fingerprint`);
}
