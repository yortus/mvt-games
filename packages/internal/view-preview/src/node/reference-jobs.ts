import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative } from 'node:path';
import process from 'node:process';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** How the writing of a new test's reference image is going. A failed run keeps Vitest's output. */
export type ReferenceStatus =
    | { readonly state: 'running' }
    | { readonly state: 'written'; readonly image: string; readonly modifiedMs: number }
    | { readonly state: 'failed'; readonly output: string };

/**
 * Runs Vitest on one visual test at a time, so that v-snap writes its
 * reference image, as it does on a new test's first run. Each test's latest
 * run is kept, so the page can show how it went after it reloads.
 */
export interface ReferenceJobs {
    readonly start: (test: TestId) => void;
    readonly statusOf: (test: TestId) => ReferenceStatus | undefined;
}

/** A test, by its file's path and its name. */
export interface TestId {
    readonly file: string;
    readonly name: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createReferenceJobs(): ReferenceJobs {
    const jobs = new Map<string, ReferenceStatus>();
    const keyOf = ({ file, name }: TestId): string => `${file}::${name}`;
    return {
        start: (test) => {
            const key = keyOf(test);
            if (jobs.get(key)?.state === 'running') return;
            const root = findVitestRoot(test.file);
            if (root === undefined) {
                jobs.set(key, { state: 'failed', output: `The preview didn't find a Vitest config above ${test.file}.` });
                return;
            }
            jobs.set(key, { state: 'running' });
            const startedMs = Date.now();
            // v-snap writes a new reference image only outside CI
            const env = { ...process.env };
            delete env.CI;
            // Vitest matches the pattern against the test's whole name, after the names of any describe blocks round it
            const child = spawn(process.execPath, [findVitestBin(root), 'run', relative(root, test.file), '-t', `${escapeRegExp(test.name)}$`], { cwd: root, env, windowsHide: true });
            let output = '';
            const collect = (chunk: Buffer): void => {
                output = (output + chunk.toString()).slice(-MAX_OUTPUT);
            };
            child.stdout.on('data', collect);
            child.stderr.on('data', collect);
            child.on('error', (error) => jobs.set(key, { state: 'failed', output: error.message }));
            child.on('exit', (code) => {
                const image = findNewImage({ file: test.file, sinceMs: startedMs });
                if (code === 0 && image !== undefined) jobs.set(key, { state: 'written', ...image });
                else jobs.set(key, { state: 'failed', output: stripColours(output).trim() || `Vitest stopped with exit code ${code ?? 'unknown'}.` });
            });
        },
        statusOf: (test) => jobs.get(keyOf(test)),
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The most of Vitest's output kept for a failed run, from its end. */
const MAX_OUTPUT = 8000;

/** Returns the nearest folder above a file that holds a Vitest config, where Vitest runs from. */
function findVitestRoot(file: string): string | undefined {
    for (let dir = dirname(file); ; dir = dirname(dir)) {
        if (VITEST_CONFIGS.some((name) => existsSync(join(dir, name)))) return dir;
        if (dirname(dir) === dir) return undefined;
    }
}

const VITEST_CONFIGS = ['vitest.config.ts', 'vitest.config.mts', 'vitest.config.js', 'vitest.config.mjs'];

/** Returns the script that Vitest's command runs, as the root's own packages reach it. */
function findVitestBin(root: string): string {
    const manifest = createRequire(join(root, 'package.json')).resolve('vitest/package.json');
    const { bin } = JSON.parse(readFileSync(manifest, 'utf8')) as { readonly bin: string | Readonly<Record<string, string>> };
    return join(dirname(manifest), typeof bin === 'string' ? bin : bin.vitest);
}

/**
 * Returns the newest reference image that v-snap wrote for a test file
 * since a time, or `undefined` if it didn't write one. A reference image is beside its
 * test file, named for the file's stem and the test, such as
 * `hud-view.a-score.png`. The images v-snap writes for a failed test are
 * named apart, and left out.
 */
function findNewImage(options: { readonly file: string; readonly sinceMs: number }): { readonly image: string; readonly modifiedMs: number } | undefined {
    const { file, sinceMs } = options;
    const dir = dirname(file);
    const stem = basename(file).replace(/\.test\.tsx?$/, '');
    let newest: { image: string; modifiedMs: number } | undefined;
    for (const name of readdirSync(dir)) {
        if (!name.startsWith(`${stem}.`) || !name.endsWith('.png') || /\.(actual|diff)\.png$/.test(name)) continue;
        const image = join(dir, name);
        const modifiedMs = statSync(image).mtimeMs;
        if (modifiedMs >= sinceMs && (newest === undefined || modifiedMs > newest.modifiedMs)) newest = { image, modifiedMs };
    }
    return newest;
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripColours(text: string): string {
    // eslint-disable-next-line no-control-regex -- the escape codes that colour a terminal's text
    return text.replace(/\x1b\[[0-9;]*m/g, '');
}
