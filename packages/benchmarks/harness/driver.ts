import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism, cpus, platform, release, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, type Plugin } from 'esbuild';
import type { Case, ParamValue, Suite, TableSpec } from './suite';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface RunOptions {
    /** Only cases whose params match all of these. */
    readonly filters: Readonly<Record<string, string>>;
    /** Processes per case, always, overriding the suite's and the adaptive default. */
    readonly runs?: number;
    /** Write `results/<suite>.json` and `results/<suite>.md`. Refused with filters. */
    readonly save: boolean;
    /** Also run the cases in the `'extended'` tier. */
    readonly extended: boolean;
    /**
     * With `save`, run a suite even when its inputs are unchanged since its
     * saved results. Without it, such a suite is skipped and its tables only
     * re-rendered.
     */
    readonly force: boolean;
    /** Most processes of counts-only cases to run at once. Timed cases always run one at a time. */
    readonly jobs: number;
}

/** One case's metrics from every process, each list sorted ascending. */
export interface CaseResult {
    readonly params: Readonly<Record<string, ParamValue>>;
    readonly metrics: Readonly<Record<string, number[]>>;
    /**
     * Set on an `'extended'` case's result that a save without `--extended`
     * kept from the previous save: the date it was measured.
     */
    readonly carriedFrom?: string;
}

/**
 * How many processes each case runs: always this many, or `'adaptive'`, two
 * and a third only if they disagree by more than 5% on a metric shown.
 */
export type RunPolicy = number | 'adaptive';

/** The default for `RunOptions.jobs`: half the logical processors, at most 8. */
export function defaultJobs(): number {
    return Math.max(1, Math.min(8, Math.floor(availableParallelism() / 2)));
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Runs a suite: bundles its measured file to plain JavaScript once, then runs
 * each case in fresh Node processes, or fresh headless Chrome pages for a
 * browser suite, and prints the suite's tables.
 *
 * Counts-only cases run first, several processes at once; then every timed
 * case, one process at a time. With `save`, a suite whose inputs (its bundle,
 * cases, run policy, this driver and the environment) match its saved results
 * is skipped, unless `force` is set.
 */
export async function runSuite(suite: Suite, options: RunOptions): Promise<void> {
    const matching = suite.cases.filter((c) => matches(c.params, options.filters));
    if (matching.length === 0) throw new Error(`no ${suite.name} cases match the filters`);
    const filtered = Object.keys(options.filters).length > 0;
    if (options.save && filtered) throw new Error('--save needs a whole suite: drop the filters');
    const cases = matching.filter((c) => options.extended || c.tier !== 'extended');
    if (cases.length === 0) throw new Error(`only extended ${suite.name} cases match the filters: add --extended`);
    const policy: RunPolicy = options.runs ?? suite.runs ?? 'adaptive';

    process.stdout.write(`\n## ${suite.name}: ${suite.description}\n\n`);
    const outDir = mkdtempSync(join(tmpdir(), `bench-${suite.name}-`));
    try {
        const isBrowser = suite.environment === 'browser';
        const bundle = await bundleEntry(suite.entry, outDir, isBrowser);
        const inputsHash = hashInputs(suite, bundle, policy, isBrowser);
        const saved = readSaved(suite);
        if (options.save && !options.force && saved?.inputsHash === inputsHash && !(options.extended && hasCarried(saved))) {
            process.stdout.write(`Unchanged since its saved results of ${saved.environment.date}: not re-run (--force runs it).\n\n`);
            reportSuite(suite);
            return;
        }

        const cacheDir = join(outDir, 'cache');
        mkdirSync(cacheDir);
        const run: AsyncCaseRunner = isBrowser
            ? asAsync(browserRunner(bundle, outDir))
            : nodeRunner(bundle, suite, cacheDir);
        const results = await runCases(run, suite, cases, policy, options.jobs);
        if (options.save && !options.extended && saved !== undefined) carryOverExtended(suite, results, saved);
        const markdown = formatTables(suite, results, policy);
        process.stdout.write(`\n${markdown}\n`);
        if (options.save) save(suite, results, policy, markdown, isBrowser ? browserVersion : undefined, inputsHash);
    }
    finally {
        rmSync(outDir, { recursive: true, force: true });
    }
}

/**
 * Re-renders a suite's saved tables from `results/<suite>.json` with its
 * current table definitions and labels, without measuring anything.
 */
export function reportSuite(suite: Suite): void {
    const saved = readSaved(suite);
    if (saved === undefined) throw new Error(`no saved results for ${suite.name}`);
    const markdown = formatTables(suite, saved.results, saved.runs);
    writeMarkdown(suite, saved.environment, saved.results, markdown);
    process.stdout.write(`${markdown}\n\nRewrote packages/benchmarks/results/${suite.name}.md\n`);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface SavedResults {
    readonly environment: Record<string, string>;
    /** A number in results saved before adaptive runs, which always ran that many. */
    readonly runs: RunPolicy;
    /** What was measured: see `hashInputs`. Absent in results saved before it. */
    readonly inputsHash?: string;
    readonly results: CaseResult[];
}

function readSaved(suite: Suite): SavedResults | undefined {
    const path = join(BENCHMARKS_DIR, 'results', `${suite.name}.json`);
    if (!existsSync(path)) return undefined;
    return JSON.parse(readFileSync(path, 'utf8')) as SavedResults;
}

function hasCarried(saved: SavedResults): boolean {
    return saved.results.some((r) => r.carriedFrom !== undefined);
}

/**
 * A hash of everything that decides a suite's numbers, apart from the
 * machine's load: the bundled measured file (the code measured, and how),
 * every case, the run policy, this driver, and the environment the saved
 * results describe. For a browser suite, also the installed browser's
 * version directories, since its version is known only after a run.
 */
function hashInputs(suite: Suite, bundle: string, policy: RunPolicy, isBrowser: boolean): string {
    const hash = createHash('sha256');
    hash.update(readFileSync(bundle));
    hash.update(readFileSync(fileURLToPath(import.meta.url)));
    const { date: _date, ...environment } = describeEnvironment();
    hash.update(JSON.stringify({ cases: suite.cases, nodeArgs: suite.nodeArgs ?? [], policy, environment }));
    if (isBrowser) hash.update(describeBrowserInstall());
    return hash.digest('hex');
}

/** The browser's path and the version-named directories beside it, which change when it updates. */
function describeBrowserInstall(): string {
    const chrome = findChrome();
    const dir = dirname(chrome);
    const versions = readdirSync(dir).filter((name) => /^\d+\.\d+\.\d+\.\d+$/.test(name)).sort();
    return `${chrome}\n${versions.join('\n')}\n${statSync(chrome).size}`;
}

/**
 * Keeps the previous save's results for `'extended'` cases this run left
 * out, marked with the date they were measured, so a routine save does not
 * drop them.
 */
function carryOverExtended(suite: Suite, results: CaseResult[], saved: SavedResults): void {
    for (let i = 0; i < suite.cases.length; i++) {
        const testCase = suite.cases[i];
        if (testCase.tier !== 'extended') continue;
        const key = JSON.stringify(testCase.params);
        const previous = saved.results.find((r) => JSON.stringify(r.params) === key);
        if (previous === undefined) continue;
        results.push({ ...previous, carriedFrom: previous.carriedFrom ?? saved.environment.date });
    }
    // Back into the suite's case order, which the tables follow
    const order = suite.cases.map((c) => JSON.stringify(c.params));
    results.sort((a, b) => order.indexOf(JSON.stringify(a.params)) - order.indexOf(JSON.stringify(b.params)));
}

const BENCHMARKS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_DIR = resolve(BENCHMARKS_DIR, '..', '..');

function matches(params: Readonly<Record<string, ParamValue>>, filters: Readonly<Record<string, string>>): boolean {
    for (const key in filters) {
        if (String(params[key]) !== filters[key]) return false;
    }
    return true;
}

async function bundleEntry(entry: string, outDir: string, isBrowser: boolean): Promise<string> {
    const outfile = join(outDir, isBrowser ? 'case.js' : 'case.mjs');
    await build({
        entryPoints: [join(BENCHMARKS_DIR, 'suites', entry)],
        outfile,
        bundle: true,
        platform: isBrowser ? 'browser' : 'node',
        format: isBrowser ? 'iife' : 'esm',
        logLevel: 'warning',
        // The @mvtjs packages resolve to their source, as in the site
        conditions: ['@mvtjs/source'],
        // Measure what a production build runs: Vite would replace these
        define: { 'import.meta.env': '{"DEV":false,"PROD":true,"MODE":"production","BASE_URL":"/"}' },
        plugins: isBrowser ? [solidBrowserBuild, nodeProcessInBrowser] : [solidBrowserBuild, stubTextureRegistry],
    });
    return outfile;
}

/**
 * The measurement helpers import `node:process`, for what only Node has. In
 * a page it is a stand-in with none of it: a browser case reads its params
 * and reports through the page instead (`measure.ts`), and may use only the
 * helpers that time frames.
 */
const nodeProcessInBrowser: Plugin = {
    name: 'node-process-in-browser',
    setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /^node:process$/ }, () => ({ path: 'node:process', namespace: 'browser-process' }));
        pluginBuild.onLoad({ filter: /.*/, namespace: 'browser-process' }, () => ({
            loader: 'js',
            contents: 'export default { argv: [], memoryUsage() { throw new Error("Not available in a browser case"); } };',
        }));
    },
};

/**
 * Node resolves solid-js to its server build, where effects never run. Every
 * import of it, from our code or from pixi-solid, goes to its browser build
 * instead, as a page gets, and so to one copy.
 */
const solidBrowserBuild: Plugin = {
    name: 'solid-browser-build',
    setup(pluginBuild) {
        const builds: Record<string, string> = {
            'solid-js': 'node_modules/solid-js/dist/solid.js',
            'solid-js/store': 'node_modules/solid-js/store/dist/store.js',
            'solid-js/web': 'node_modules/solid-js/web/dist/web.js',
        };
        pluginBuild.onResolve({ filter: /^solid-js(\/store|\/web)?$/ }, (args) => ({ path: join(REPO_DIR, builds[args.path]) }));
    },
};

/**
 * Loading a spritesheet needs a browser. For the games and demos, every
 * texture becomes Pixi's 1x1 `Texture.WHITE`: models do not read textures, and
 * the benchmarks exclude rendering, so this changes only what would be drawn.
 */
const stubTextureRegistry: Plugin = {
    name: 'stub-texture-registry',
    setup(pluginBuild) {
        pluginBuild.onLoad({ filter: /[\\/]packages[\\/]pixi[\\/]src[\\/]texture-registry\.ts$/ }, () => ({
            loader: 'ts',
            resolveDir: join(REPO_DIR, 'packages/pixi/src'),
            contents: [
                `import { Texture } from 'pixi.js';`,
                `export function createTextureRegistry(_url: string, nameMap: Record<string, unknown>) {`,
                `    const build = (map: Record<string, unknown>): Record<string, unknown> => {`,
                `        const record: Record<string, unknown> = {};`,
                `        for (const key in map) {`,
                `            const value = map[key];`,
                `            record[key] = typeof value === 'string' ? Texture.WHITE : build(value as Record<string, unknown>);`,
                `        }`,
                `        return record;`,
                `    };`,
                `    const record = build(nameMap);`,
                `    return { async load() {}, get() { return record; } };`,
                `}`,
            ].join('\n'),
        }));
    },
};

/** What one run of a case reported: its line of JSON, or why it failed. */
type RunOutput = { readonly line: string } | { readonly error: string };

/** Runs one case once. */
type CaseRunner = (testCase: Case) => RunOutput;

/** Runs one case once, in a Node process, without blocking the driver. */
type AsyncCaseRunner = (testCase: Case) => Promise<RunOutput>;

function asAsync(run: CaseRunner): AsyncCaseRunner {
    return (testCase) => Promise.resolve(run(testCase));
}

/**
 * Runs each case in its own Node process. A case may keep what it builds
 * slowly and deterministically, such as a filled falling-sand tank, in
 * `cacheDir` (passed as `MVT_BENCH_CACHE_DIR`; see `harness/case-cache.ts`),
 * so later processes of the same suite, which run the same bundle, can load
 * it instead. The directory goes with the run.
 */
function nodeRunner(bundle: string, suite: Suite, cacheDir: string): AsyncCaseRunner {
    const env = { ...process.env, MVT_BENCH_CACHE_DIR: cacheDir };
    return (testCase) => new Promise((resolveRun) => {
        const nodeArgs = [...(suite.nodeArgs ?? []), ...(testCase.nodeArgs ?? [])];
        const child = spawn(process.execPath, [...nodeArgs, bundle, JSON.stringify(testCase.params)], { env });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
            stdout += chunk;
        });
        child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
            stderr += chunk;
        });
        child.on('error', (error) => resolveRun({ error: String(error) }));
        child.on('close', (status) => {
            if (status !== 0) {
                resolveRun({ error: stderr });
                return;
            }
            const lines = stdout.trim().split('\n');
            resolveRun({ line: lines[lines.length - 1] });
        });
    });
}

/**
 * Runs a Node suite's cases: the counts-only ones first, up to `jobs`
 * processes at once, then the timed ones, one process at a time, so no timed
 * process ever shares the machine with another. Results come back in the
 * suite's case order; a case that failed is left out.
 */
async function runCases(
    run: AsyncCaseRunner, suite: Suite, cases: readonly Case[], policy: RunPolicy, jobs: number,
): Promise<CaseResult[]> {
    const results: (CaseResult | undefined)[] = new Array(cases.length).fill(undefined);

    const counting: number[] = [];
    for (let i = 0; i < cases.length; i++) {
        if (cases[i].countsOnly === true) counting.push(i);
    }
    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < counting.length) {
            const index = counting[next++];
            results[index] = await runCase(run, suite, cases[index], policy, true);
        }
    };
    const workers: Promise<void>[] = [];
    for (let w = 0; w < Math.min(jobs, counting.length); w++) workers.push(worker());
    await Promise.all(workers);

    for (let i = 0; i < cases.length; i++) {
        if (cases[i].countsOnly !== true) results[i] = await runCase(run, suite, cases[i], policy, false);
    }
    return results.filter((r): r is CaseResult => r !== undefined);
}

/** The browser that ran the last browser case, from its user agent. */
let browserVersion: string | undefined;

/**
 * Runs each case in a fresh headless Chrome: the bundle inlined in a page
 * with the case's params, which reports its metrics into the page, read back
 * with `--dump-dom`. Chrome is found at `CHROME_PATH`, or where it installs by
 * default.
 *
 * The cases share one profile, removed with `outDir`. Chrome 153 and later
 * test a new profile's Windows password by logging in with a blank one, and
 * Windows counts each try as a failed logon: a fresh profile per case locked
 * the account out after ten cases.
 */
function browserRunner(bundle: string, outDir: string): CaseRunner {
    const chrome = findChrome();
    const code = readFileSync(bundle, 'utf8');
    if (code.includes('</script')) throw new Error('the bundle contains </script, so it cannot be inlined in a page');
    const profile = join(outDir, 'profile');
    return (testCase) => {
        const page = join(outDir, 'case.html');
        writeFileSync(page, [
            '<!doctype html><html><head><meta charset="utf-8"></head><body>',
            `<script>globalThis.mvtBenchParams = ${JSON.stringify(testCase.params)};`,
            'document.documentElement.dataset.userAgent = navigator.userAgent;',
            'addEventListener("error", (e) => {',
            '    const pre = document.createElement("pre"); pre.id = "mvt-bench-error";',
            '    pre.textContent = String(e.error?.stack ?? e.message); document.body.append(pre);',
            '});</script>',
            `<script>${code}</script>`,
            '</body></html>',
        ].join('\n'));
        const child = spawnSync(chrome, [
            '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
            `--user-data-dir=${profile}`, '--dump-dom', pathToFileURL(page).href,
        ], { encoding: 'utf8', timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
        const dom = child.stdout ?? '';
        browserVersion = /data-user-agent="[^"]*?((?:Chrome|Edg)\/[\d.]+)/.exec(dom)?.[1] ?? browserVersion;
        const result = /<pre id="mvt-bench-result">([^<]*)<\/pre>/.exec(dom);
        if (result !== null) return { line: result[1] };
        const error = /<pre id="mvt-bench-error">([^<]*)<\/pre>/.exec(dom);
        return { error: error?.[1] ?? `no result from ${chrome} (status ${child.status}): ${child.stderr}` };
    };
}

function findChrome(): string {
    const candidates = [
        process.env.CHROME_PATH,
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
    ];
    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (candidate !== undefined && existsSync(candidate)) return candidate;
    }
    throw new Error('no Chrome found to run a browser suite: set CHROME_PATH');
}

/**
 * Runs one case as many times as `policy` asks, printing its progress line:
 * as it goes, or all at once when `isBuffered`, for a case running in
 * parallel with others.
 */
async function runCase(
    run: AsyncCaseRunner, suite: Suite, testCase: Case, policy: RunPolicy, isBuffered: boolean,
): Promise<CaseResult | undefined> {
    let buffered = '';
    const print = (text: string): void => {
        if (isBuffered) buffered += text;
        else process.stdout.write(text);
    };
    print(`${describeParams(testCase.params)} ...`);
    const shown = shownMetrics(suite, testCase.params);
    const metrics: Record<string, number[]> = {};
    const startMs = performance.now();
    for (let r = 0; needsAnotherRun(policy, r, metrics, shown); r++) {
        const output = await run(testCase);
        if ('error' in output) {
            print(` failed\n${output.error}\n`);
            if (isBuffered) process.stdout.write(buffered);
            process.exitCode = 1;
            return undefined;
        }
        const reported = JSON.parse(output.line) as Record<string, number>;
        for (const key in reported) {
            const values = (metrics[key] ??= []);
            values.push(reported[key]);
            values.sort((a, b) => a - b);
        }
        print(` ${formatMetrics(reported)}`);
    }
    print(` (${((performance.now() - startMs) / 1000).toFixed(1)} s)\n`);
    if (isBuffered) process.stdout.write(buffered);
    return { params: testCase.params, metrics };
}

/** A metric some table shows for a case, and how it is rounded there. */
interface ShownMetric {
    readonly key: string;
    readonly maxDecimals: number | undefined;
}

/** The metrics the suite's tables show for a case with these params. */
function shownMetrics(suite: Suite, params: Readonly<Record<string, ParamValue>>): ShownMetric[] {
    const shown: ShownMetric[] = [];
    for (let t = 0; t < suite.tables.length; t++) {
        const spec = suite.tables[t];
        if (!matches(params, stringify(spec.where ?? {}))) continue;
        if (spec.metrics !== undefined) {
            for (let m = 0; m < spec.metrics.length; m++) {
                shown.push({ key: spec.metrics[m].key, maxDecimals: spec.metrics[m].maxDecimals });
            }
        }
        else if (spec.metric !== undefined) shown.push({ key: spec.metric, maxDecimals: spec.maxDecimals });
    }
    return shown;
}

/**
 * Whether a case needs another run after `runsSoFar`: under a fixed policy,
 * until it has that many; adaptively, two, and a third only if the two
 * disagree on a shown metric by more than the tables' ± threshold.
 */
function needsAnotherRun(
    policy: RunPolicy, runsSoFar: number, metrics: Record<string, number[]>, shown: readonly ShownMetric[],
): boolean {
    if (policy !== 'adaptive') return runsSoFar < policy;
    if (runsSoFar < ADAPTIVE_MIN_RUNS) return true;
    if (runsSoFar >= ADAPTIVE_MAX_RUNS) return false;
    for (let i = 0; i < shown.length; i++) {
        const values = metrics[shown[i].key];
        if (values !== undefined && spreadPercent(values, shown[i].maxDecimals) > SPREAD_SHOWN_ABOVE_PERCENT) return true;
    }
    return false;
}

const ADAPTIVE_MIN_RUNS = 2;
const ADAPTIVE_MAX_RUNS = 3;

function formatTables(suite: Suite, results: CaseResult[], runs: RunPolicy): string {
    const sections: string[] = [];
    for (let t = 0; t < suite.tables.length; t++) {
        const table = formatTable(suite, suite.tables[t], results, runs);
        if (table !== undefined) sections.push(table);
    }
    return sections.join('\n\n');
}

function formatTable(suite: Suite, spec: TableSpec, results: CaseResult[], runs: RunPolicy): string | undefined {
    const where = stringify(spec.where ?? {});
    const rows = results.filter((r) => matches(r.params, where));
    if (rows.length === 0) return undefined;

    const lines = [
        `<!-- #region ${spec.id} -->`,
        `**${spec.title}** (${describeCells(runs)})`,
        '',
    ];
    const rowHeadings = spec.rows.map((key) => titleOf(suite, key));
    // A leading label that repeats the row above is left blank, so rows that
    // share a scenario read as one group
    let previousLabels: string[] = [];
    const rowLabels = (result: CaseResult): string[] => {
        const labels = spec.rows.map((key) => label(suite, key, result.params[key]));
        const shown = blankRepeats(labels, previousLabels);
        previousLabels = labels;
        return shown;
    };

    if (spec.metrics !== undefined) {
        const metrics = spec.metrics;
        pushHeader(lines, [...rowHeadings, ...metrics.map((m) => m.title)]);
        for (let r = 0; r < rows.length; r++) {
            const cells = metrics.map((m) => formatResultCell(rows[r], m.key, m.maxDecimals));
            lines.push(`| ${[...rowLabels(rows[r]), ...cells].join(' | ')} |`);
        }
    }
    else {
        const metric = spec.metric;
        if (metric === undefined) throw new Error(`table ${spec.id} needs a metric or metrics`);
        const column = spec.column;
        if (column === undefined) {
            pushHeader(lines, [...rowHeadings, `${titleOf(suite, metric)} (${spec.unit ?? ''})`]);
            for (let r = 0; r < rows.length; r++) {
                lines.push(`| ${[...rowLabels(rows[r]), formatResultCell(rows[r], metric, spec.maxDecimals)].join(' | ')} |`);
            }
        }
        else {
            const columns = unique(rows.map((r) => r.params[column]));
            const rowKeys = unique(rows.map((r) => rowKeyOf(spec, r)));
            lines[1] = `**${spec.title}** (${spec.unit ?? ''}; ${describeCells(runs)})`;
            pushHeader(lines, [...rowHeadings, ...columns.map((c) => label(suite, column, c))]);
            for (let k = 0; k < rowKeys.length; k++) {
                const inRow = rows.filter((r) => rowKeyOf(spec, r) === rowKeys[k]);
                const cells = columns.map((c) => {
                    const result = inRow.find((r) => r.params[column] === c);
                    return result === undefined ? '' : formatResultCell(result, metric, spec.maxDecimals);
                });
                lines.push(`| ${[...rowLabels(inRow[0]), ...cells].join(' | ')} |`);
            }
        }
    }
    lines.push(`<!-- #endregion ${spec.id} -->`);
    return lines.join('\n');
}

/** Blanks each leading label equal to the one above it, stopping at the first that differs. */
function blankRepeats(labels: string[], above: string[]): string[] {
    const shown = labels.slice();
    for (let i = 0; i < shown.length - 1 && shown[i] === above[i]; i++) shown[i] = '';
    return shown;
}

function pushHeader(lines: string[], headings: string[]): void {
    lines.push(`| ${headings.join(' | ')} |`, `|${' --- |'.repeat(headings.length)}`);
}

function rowKeyOf(spec: TableSpec, result: CaseResult): string {
    return spec.rows.map((key) => result.params[key]).join('\u0000');
}

/** Spreads at or below this share of the median are not shown. */
const SPREAD_SHOWN_ABOVE_PERCENT = 5;

function describeCells(runs: RunPolicy): string {
    const median = runs === 'adaptive'
        ? `median of ${ADAPTIVE_MIN_RUNS} runs, or ${ADAPTIVE_MAX_RUNS} where the first ${ADAPTIVE_MIN_RUNS} disagreed by more than ${SPREAD_SHOWN_ABOVE_PERCENT}%, each in its own process`
        : `median of ${runs} runs, each in its own process`;
    return `${median}; ± marks runs that disagreed by more than ${SPREAD_SHOWN_ABOVE_PERCENT}%`;
}

/** A result's cell for one metric, marked † if it was carried over from an earlier save. */
function formatResultCell(result: CaseResult, key: string, maxDecimals: number | undefined): string {
    const cell = formatCell(result.metrics[key], maxDecimals);
    return result.carriedFrom === undefined ? cell : `${cell} †`;
}

/**
 * The median, then half the spread between the lowest and highest run as a
 * share of the median, when that is more than 5%: `3.8 ±40%`. Smaller spreads,
 * and medians that round to zero, show just the value.
 */
function formatCell(values: number[], maxDecimals = 2): string {
    const shown = formatNumber(medianOf(values), maxDecimals);
    if (shown === '0') return shown;
    const spread = spreadPercent(values, maxDecimals);
    if (spread <= SPREAD_SHOWN_ABOVE_PERCENT) return shown;
    return `${shown} ±${spread}%`;
}

/** The median of sorted values: the middle one, or the mean of the middle two. */
function medianOf(values: readonly number[]): number {
    const middle = Math.floor(values.length / 2);
    return values.length % 2 === 1 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

/**
 * Half the spread between the lowest and highest of sorted values, as a whole
 * percentage of their median; 0 where the median rounds to zero as shown.
 */
function spreadPercent(values: readonly number[], maxDecimals = 2): number {
    const median = medianOf(values);
    if (formatNumber(median, maxDecimals) === '0') return 0;
    return Math.round(((values[values.length - 1] - values[0]) / 2 / median) * 100);
}

/**
 * At most `maxDecimals` decimal places, then 3 significant figures, with
 * thousands separators: `0.01`, `8.02`, `130`, `96,600`.
 */
function formatNumber(value: number, maxDecimals: number): string {
    const rounded = Number(value.toFixed(maxDecimals));
    if (rounded === 0) return '0';
    return rounded.toLocaleString('en-US', { maximumSignificantDigits: 3 });
}

function label(suite: Suite, key: string, value: ParamValue): string {
    return suite.labels?.[key]?.[String(value)] ?? String(value);
}

const DEFAULT_TITLES: Readonly<Record<string, string>> = {
    approach: 'Approach',
    changedPercent: 'Changed per frame',
    dynamicProperties: 'Dynamic properties',
    count: 'Containers',
    scenario: 'Scenario',
    spawnPerFrame: 'New items per frame',
};

/** A row heading for a param, e.g. `changedPercent` -> `Changed per frame`. */
function titleOf(suite: Suite, key: string): string {
    const title = suite.titles?.[key] ?? DEFAULT_TITLES[key];
    if (title !== undefined) return title;
    const words = key.replace(/([A-Z])/g, ' $1').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

function describeParams(params: Readonly<Record<string, ParamValue>>): string {
    const parts: string[] = [];
    for (const key in params) parts.push(`${key}=${params[key]}`);
    return parts.join(' ');
}

function formatMetrics(metrics: Record<string, number>): string {
    const parts: string[] = [];
    for (const key in metrics) parts.push(`${key}=${Number(metrics[key].toPrecision(4))}`);
    return parts.join(',');
}

function stringify(params: Readonly<Record<string, ParamValue>>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key in params) result[key] = String(params[key]);
    return result;
}

function unique<T>(values: T[]): T[] {
    const result: T[] = [];
    for (let i = 0; i < values.length; i++) {
        if (!result.includes(values[i])) result.push(values[i]);
    }
    return result;
}

function save(
    suite: Suite, results: CaseResult[], runs: RunPolicy, markdown: string, browser: string | undefined, inputsHash: string,
): void {
    const dir = join(BENCHMARKS_DIR, 'results');
    mkdirSync(dir, { recursive: true });
    const environment = describeEnvironment();
    if (browser !== undefined) environment.browser = browser;
    const saved: SavedResults & { readonly suite: string } = { suite: suite.name, environment, runs, inputsHash, results };
    writeFileSync(join(dir, `${suite.name}.json`), `${JSON.stringify(saved, undefined, 4)}\n`);
    writeMarkdown(suite, environment, results, markdown);
    process.stdout.write(`\nSaved packages/benchmarks/results/${suite.name}.json and .md\n`);
}

function writeMarkdown(suite: Suite, environment: Record<string, string>, results: readonly CaseResult[], markdown: string): void {
    const header = [
        `<!-- Generated by \`npm run bench -- ${suite.name} --save\`. Do not edit by hand. -->`,
        '',
        `<!-- #region environment -->`,
        environment.browser === undefined
            ? `Measured ${environment.date} on ${environment.cpu}, ${environment.os}, Node.js ${environment.node} (V8 ${environment.v8}), pixi.js ${environment.pixi}, solid-js ${environment.solid}.`
            : `Measured ${environment.date} on ${environment.cpu}, ${environment.os}, in headless ${environment.browser.replace('/', ' ')}.`,
        `<!-- #endregion environment -->`,
    ];
    const notes = suite.notes?.slice() ?? [];
    const carriedDates = unique(results.flatMap((r) => (r.carriedFrom === undefined ? [] : [r.carriedFrom]))).sort();
    if (carriedDates.length > 0) {
        notes.push(`† Not re-run in this save: an extended case, run only with \`--extended\`, last measured ${carriedDates.join(', ')}.`);
    }
    if (notes.length > 0) {
        header.push('', `<!-- #region notes -->`);
        for (let i = 0; i < notes.length; i++) header.push(`- ${notes[i]}`);
        header.push(`<!-- #endregion notes -->`);
    }
    writeFileSync(join(BENCHMARKS_DIR, 'results', `${suite.name}.md`), `${header.join('\n')}\n\n${markdown}\n`);
}

function describeEnvironment(): Record<string, string> {
    return {
        date: new Date().toISOString().slice(0, 10),
        cpu: cpus()[0]?.model.trim() ?? 'unknown CPU',
        os: `${platform()} ${release()}`,
        node: process.versions.node,
        v8: process.versions.v8,
        pixi: packageVersion('pixi.js'),
        solid: packageVersion('solid-js'),
    };
}

function packageVersion(name: string): string {
    const json = readFileSync(join(REPO_DIR, 'node_modules', name, 'package.json'), 'utf8');
    return (JSON.parse(json) as { version: string }).version;
}
