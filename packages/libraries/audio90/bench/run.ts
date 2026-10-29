/**
 * The sound chips' benchmarks: how long each synthesiser takes to render a
 * block of samples, as a browser's audio thread asks for one, and how much
 * it allocates while it does; how long a busy song takes a tick; and how
 * long bouncing a sample takes.
 *
 * Each suite's file is bundled first, as an app's build bundles the chip,
 * since a bundle can run differently from its source: a bundler may turn a
 * module's constant into a variable, and a number read from it then costs an
 * allocation. Then each case runs in a process of its own, three times, and
 * the tables show the median. A count, such as the bytes allocated, is the
 * same each time, so it runs once.
 *
 *   npm run bench                          every suite
 *   npm run bench -- audio90               one suite
 *   npm run bench -- audio90 engine=fm     only the cases that match
 *   npm run bench -- audio80 --runs=5      each case in five processes
 *   npm run bench -- --save                and write bench/results/<suite>.md
 *
 * The saved results are kept with the code, so a change's effect on them
 * shows in its diff. A busy machine slows every case by 10% or more, so
 * compare runs made one after the other, with nothing else running.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, platform, release, tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { build, type Plugin } from 'rolldown';
import { type Case, type Params, SUITES, type Suite, type Table } from './suites.ts';

/** What a case reported in each of its runs, by metric. */
interface Result {
    readonly params: Params;
    readonly metrics: Readonly<Record<string, readonly number[]>>;
}

const BENCH_DIR = import.meta.dirname;
const DEFAULT_RUNS = 3;
/** Runs of a case that disagree by more than this share of their median are marked with ±. */
const SPREAD_SHOWN_ABOVE = 0.05;

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        runs: { type: 'string' },
        save: { type: 'boolean', default: false },
    },
});
const runCount = values.runs === undefined ? DEFAULT_RUNS : Number(values.runs);
const filters = Object.fromEntries(positionals.filter((arg) => arg.includes('=')).map((arg) => arg.split('=', 2)));
if (values.save && Object.keys(filters).length > 0) throw new Error('--save writes every case\'s result, so it takes no filters.');
const suites = positionals.filter((arg) => !arg.includes('=')).map(findSuite);

const outDir = mkdtempSync(join(tmpdir(), 'audio90-bench-'));
try {
    for (const suite of suites.length === 0 ? SUITES : suites) await runSuite(suite);
}
finally {
    rmSync(outDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Runs each of a suite's cases that match the filters, then prints its tables, and saves them with `--save`. */
async function runSuite(suite: Suite): Promise<void> {
    console.log(`${suite.name}: ${suite.description}`);
    const bundle = join(outDir, `${suite.name}.mjs`);
    await build({
        input: join(BENCH_DIR, suite.file),
        platform: 'node',
        logLevel: 'warn',
        plugins: [stubWorkletUrls()],
        output: { file: bundle, format: 'esm' },
    });
    const results: Result[] = [];
    for (const testCase of suite.cases) {
        if (!matchesFilters(testCase.params)) continue;
        const metrics: Record<string, number[]> = {};
        const runs = testCase.isCount === true ? 1 : runCount;
        for (let run = 0; run < runs; run++) {
            for (const [key, value] of Object.entries(runCase(bundle, testCase))) (metrics[key] ??= []).push(value);
        }
        results.push({ params: testCase.params, metrics });
        const shown = Object.entries(metrics).map(([key, measured]) => `${key} ${formatMeasured(measured)}`);
        console.log(`  ${describeParams(testCase.params)}: ${shown.join(', ')}`);
    }
    const tables = suite.tables.map((table) => formatTable(suite, table, results)).filter((table) => table !== undefined);
    console.log(`\n${tables.join('\n\n')}\n`);
    if (!values.save) return;
    const environment = `Measured ${new Date().toISOString().slice(0, 10)} on ${cpus()[0]?.model.trim() ?? 'an unknown processor'}, ${platform()} ${release()}, Node.js ${process.versions.node}.`;
    const method = `Each time is the median of ${runCount} runs, each in its own process, and ± marks runs that disagreed by more than ${SPREAD_SHOWN_ABOVE * 100}%. Each count ran once.`;
    const header = `<!-- Written by \`npm run bench -- ${suite.name} --save\`. Don't edit it by hand. -->`;
    writeFileSync(join(BENCH_DIR, 'results', `${suite.name}.md`), `${header}\n\n${environment} ${method}\n\n${tables.join('\n\n')}\n`);
}

/** Runs one case in a process of its own, and returns the metrics it reported. */
function runCase(bundle: string, testCase: Case): Record<string, number> {
    const child = spawnSync(process.execPath, [...(testCase.nodeArgs ?? []), bundle, JSON.stringify(testCase.params)], { encoding: 'utf8' });
    if (child.status !== 0) throw new Error(`The case ${describeParams(testCase.params)} failed:\n${child.stderr}`);
    const lines = child.stdout.trim().split('\n');
    return JSON.parse(lines[lines.length - 1]) as Record<string, number>;
}

/** Returns a table of the results, in Markdown, or undefined if no result belongs in it. */
function formatTable(suite: Suite, table: Table, results: readonly Result[]): string | undefined {
    const rows = results.filter((result) => Object.entries(table.where).every(([key, value]) => result.params[key] === value));
    if (rows.length === 0) return undefined;
    const label = (param: string, value: string | number): string => suite.labels[param]?.[String(value)] ?? String(value);
    const rowValues = [...new Set(rows.map((result) => result.params[table.row]))];
    let title = `**${table.title}**`;
    let headings: string[] = [];
    let cellsOf: (rowValue: string | number) => string[] = () => [];
    if (table.column !== undefined) {
        const { param, metric, unit, maxDecimals } = table.column;
        const columnValues = [...new Set(rows.map((result) => result.params[param]))];
        title += ` (${unit})`;
        headings = columnValues.map((value) => label(param, value));
        cellsOf = (rowValue) => columnValues.map((columnValue) => {
            const result = rows.find((r) => r.params[table.row] === rowValue && r.params[param] === columnValue);
            return result === undefined ? '' : formatMeasured(result.metrics[metric], maxDecimals);
        });
    }
    else if (table.metrics !== undefined) {
        const metrics = table.metrics;
        headings = metrics.map((metric) => metric.title);
        cellsOf = (rowValue) => {
            const result = rows.find((r) => r.params[table.row] === rowValue);
            return metrics.map((metric) => (result === undefined ? '' : formatMeasured(result.metrics[metric.key], metric.maxDecimals)));
        };
    }
    const rowHeading = table.row.charAt(0).toUpperCase() + table.row.slice(1);
    const lines = [
        title,
        '',
        `| ${[rowHeading, ...headings].join(' | ')} |`,
        `| ${[rowHeading, ...headings].map(() => '---').join(' | ')} |`,
        ...rowValues.map((rowValue) => `| ${[label(table.row, rowValue), ...cellsOf(rowValue)].join(' | ')} |`),
    ];
    return lines.join('\n');
}

/** Returns the median of a metric's runs, to three figures, marked with ± and their spread if they disagreed. */
function formatMeasured(measured: readonly number[] | undefined, maxDecimals?: number): string {
    if (measured === undefined || measured.length === 0) return '';
    const sorted = [...measured].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    // Three figures, since a timing is good to a few per cent at best
    const rounded = maxDecimals === 0 || median >= 100 ? Math.round(median) : Number(median.toPrecision(3));
    const text = rounded.toLocaleString('en-US', { maximumFractionDigits: 3 });
    const spread = median > 0 ? (sorted[sorted.length - 1] - sorted[0]) / median : 0;
    return spread > SPREAD_SHOWN_ABOVE ? `${text} ±${Math.round(spread * 100)}%` : text;
}

/**
 * The browser's chips import their worklets' URLs with Vite's `?worker&url`,
 * which only Vite understands. Nothing measured here plays in a browser, so
 * each URL is left empty.
 */
function stubWorkletUrls(): Plugin {
    const stub = '\0worklet-url';
    return {
        name: 'stub-worklet-urls',
        resolveId: (source) => (source.endsWith('?worker&url') ? stub : undefined),
        load: (id) => (id === stub ? 'export default "";' : undefined),
    };
}

function matchesFilters(params: Params): boolean {
    return Object.entries(filters).every(([key, value]) => String(params[key]) === value);
}

function describeParams(params: Params): string {
    return Object.entries(params).map(([key, value]) => `${key}=${value}`).join(' ');
}

function findSuite(name: string): Suite {
    const suite = SUITES.find((s) => s.name === name);
    if (suite === undefined) throw new Error(`There is no suite '${name}'. The suites are ${SUITES.map((s) => s.name).join(' and ')}.`);
    return suite;
}
