/**
 * The speed benchmark: the same images, of the same Pixi views, checked two
 * ways. One is v-snap's `canvasTest`. The other is what a project would write
 * without v-snap: a Pixi canvas in the page, checked with Vitest's own
 * `toMatchScreenshot`, with Vitest's browser mode at its defaults. Both run
 * in the same browser, launched with the same settings.
 *
 * It writes the test files into .vitest/bench/, runs each way once to write
 * the reference images, then times each way's runs, taking turns, and prints
 * the medians. Every timed run compares every image with its reference, and
 * every image must pass.
 *
 *   npm run bench -w v-snap
 *   npm run bench -w v-snap -- --files 20 --tests 10 --runs 3
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { availableParallelism, cpus, platform, release } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

/** v-snap's package folder. */
const PACKAGE_DIR = join(import.meta.dirname, '..');

/** The folder that the test files, their references and the results go in. */
const OUT_DIR = join(PACKAGE_DIR, '.vitest', 'bench');

const { values } = parseArgs({
    options: {
        files: { type: 'string', default: '100' },
        tests: { type: 'string', default: '10' },
        runs: { type: 'string', default: '3' },
    },
});
const fileCount = Number(values.files);
const testsPerFile = Number(values.tests);
const runCount = Number(values.runs);

const require = createRequire(import.meta.url);
const vitest = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');

/**
 * The ways, by name, with the config that runs each, the folder of its test
 * files, and its arguments to Vitest. The screenshot tests run twice: with
 * Vitest's defaults, which open a page for each processor core but one and
 * run that many files at once, and one file at a time, in one page, as
 * v-snap's canvas tests run.
 */
const WAYS = [
    { name: 'toMatchScreenshot', config: 'bench/vitest.screenshots.config.ts', dir: 'screenshots', args: [] },
    { name: 'toMatchScreenshot, one page', config: 'bench/vitest.screenshots.config.ts', dir: 'screenshots', args: ['--no-file-parallelism'] },
    { name: 'v-snap', config: 'bench/vitest.vsnap.config.ts', dir: 'vsnap', args: [] },
] as const;

type Way = (typeof WAYS)[number];

interface RunResult {
    /** The run's wall-clock time, from starting Vitest to its exit, in milliseconds. */
    readonly wallMs: number;
    /** Each test's duration, as Vitest measured it, in milliseconds. */
    readonly testMs: readonly number[];
}

writeTestFiles();
console.log(`${fileCount * testsPerFile} images in ${fileCount} files, ${runCount} timed runs of each way.`);
for (const way of WAYS) {
    console.log(`Writing the references, and warming up: ${way.name}`);
    runWay(way, ['-u']);
}

const results = new Map<string, RunResult[]>(WAYS.map((way) => [way.name, []]));
for (let run = 1; run <= runCount; run++) {
    for (const way of WAYS) {
        const result = runWay(way, []);
        results.get(way.name)?.push(result);
        console.log(`Run ${run}, ${way.name}: ${(result.wallMs / 1000).toFixed(1)} s`);
    }
}

printSummary();

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Writes each way's test files, the same images for both, in place of any from an earlier run. */
function writeTestFiles(): void {
    rmSync(OUT_DIR, { recursive: true, force: true });
    mkdirSync(join(OUT_DIR, 'screenshots'), { recursive: true });
    mkdirSync(join(OUT_DIR, 'vsnap'), { recursive: true });
    for (let file = 0; file < fileCount; file++) {
        const name = `panels-${String(file).padStart(3, '0')}.test.ts`;
        const snap = [
            `import { canvasTest } from '../../../bench/vsnap.config';`,
            `import { measurePanel, PanelView } from '../../../bench/views';`,
            '',
        ];
        const shot = [
            `import { expect, test } from 'vitest';`,
            `import { page } from 'vitest/browser';`,
            `import { drawPanel } from '../../../bench/screenshots';`,
            '',
        ];
        for (let test = 0; test < testsPerFile; test++) {
            const index = file * testsPerFile + test;
            snap.push(`canvasTest('panel ${index}', measurePanel(${index}), () => PanelView({ index: ${index} }));`);
            shot.push(
                `test('panel ${index}', async () => {`,
                `    const canvas = await drawPanel(${index});`,
                `    await expect.element(page.elementLocator(canvas)).toMatchScreenshot('panel-${index}');`,
                '});',
            );
        }
        writeFileSync(join(OUT_DIR, 'vsnap', name), `${snap.join('\n')}\n`);
        writeFileSync(join(OUT_DIR, 'screenshots', name), `${shot.join('\n')}\n`);
    }
}

/** Runs one way's tests, and returns its times. Stops the benchmark if any test fails. */
function runWay(way: Way, args: readonly string[]): RunResult {
    const report = join(OUT_DIR, 'report.json');
    const start = performance.now();
    const run = spawnSync(process.execPath, [vitest, 'run', '--config', way.config, '--reporter=json', `--outputFile=${report}`, ...way.args, ...args], {
        cwd: PACKAGE_DIR,
        encoding: 'utf8',
        env: { ...process.env, CI: '' },
    });
    const wallMs = performance.now() - start;
    if (run.status !== 0) {
        console.error(run.stdout, run.stderr);
        throw new Error(`The ${way.name} tests failed, with exit code ${String(run.status)}.`);
    }
    const json = JSON.parse(readFileSync(report, 'utf8')) as {
        readonly numPassedTests: number;
        readonly testResults: readonly { readonly assertionResults: readonly { readonly duration?: number }[] }[];
    };
    if (json.numPassedTests !== fileCount * testsPerFile) {
        throw new Error(`The ${way.name} run passed ${String(json.numPassedTests)} tests, not ${String(fileCount * testsPerFile)}.`);
    }
    const testMs = json.testResults.flatMap((file) => file.assertionResults.map((test) => test.duration ?? 0));
    return { wallMs, testMs };
}

/** Prints each way's medians, and how many times as long as v-snap's each takes, then writes them to results.json. */
function printSummary(): void {
    const measured = WAYS.map((way) => {
        const runs = results.get(way.name) ?? [];
        const all = runs.flatMap((run) => run.testMs);
        return {
            way: way.name,
            wallSeconds: findMedian(runs.map((run) => run.wallMs)) / 1000,
            medianTestMs: findMedian(all),
            p95TestMs: findPercentile(all, 0.95),
        };
    });
    const snap = measured[measured.length - 1];
    const rows = measured.map((row) => ({
        way: row.way,
        wallSeconds: round(row.wallSeconds, 1),
        timesVsnapWall: round(row.wallSeconds / snap.wallSeconds, 1),
        medianTestMs: round(row.medianTestMs, 1),
        timesVsnapTest: round(row.medianTestMs / snap.medianTestMs, 1),
        p95TestMs: round(row.p95TestMs, 1),
    }));
    const environment = {
        images: fileCount * testsPerFile,
        files: fileCount,
        runs: runCount,
        cpu: cpus()[0]?.model.trim(),
        cores: availableParallelism(),
        system: `${platform()} ${release()}`,
        node: process.version,
        vitest: readVersion('vitest'),
        playwright: readVersion('playwright'),
    };
    console.log();
    console.table(rows);
    console.log('wallSeconds is the median run, start-up included, and medianTestMs the median test.');
    console.log('timesVsnap is how many times as long as v-snap\'s each takes.');
    console.log(environment);
    writeFileSync(join(OUT_DIR, 'results.json'), `${JSON.stringify({ environment, rows }, undefined, 4)}\n`);
}

/** Returns a package's installed version. */
function readVersion(name: string): string {
    return (JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8')) as { readonly version: string }).version;
}

/** Returns the median of some numbers. */
function findMedian(numbers: readonly number[]): number {
    return findPercentile(numbers, 0.5);
}

/** Returns the value below which a fraction of some numbers fall, by the nearest rank. */
function findPercentile(numbers: readonly number[], fraction: number): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))] ?? 0;
}

/** Returns a number rounded to some decimal places. */
function round(value: number, places: number): number {
    const scale = 10 ** places;
    return Math.round(value * scale) / scale;
}
