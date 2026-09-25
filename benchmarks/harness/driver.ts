import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, platform, release, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build, type Plugin } from 'esbuild';
import type { Case, ParamValue, Suite, TableSpec } from './suite';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface RunOptions {
    /** Only cases whose params match all of these. */
    readonly filters: Readonly<Record<string, string>>;
    /** Processes per case, overriding the suite's. */
    readonly runs?: number;
    /** Write `results/<suite>.json` and `results/<suite>.md`. Refused with filters. */
    readonly save: boolean;
}

/** One case's metrics from every process, each list sorted ascending. */
export interface CaseResult {
    readonly params: Readonly<Record<string, ParamValue>>;
    readonly metrics: Readonly<Record<string, number[]>>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Runs a suite: bundles its measured file to plain JavaScript once, then runs
 * each case in fresh Node processes and prints the suite's tables.
 */
export async function runSuite(suite: Suite, options: RunOptions): Promise<void> {
    const cases = suite.cases.filter((c) => matches(c.params, options.filters));
    if (cases.length === 0) throw new Error(`no ${suite.name} cases match the filters`);
    const filtered = Object.keys(options.filters).length > 0;
    if (options.save && filtered) throw new Error('--save needs a whole suite: drop the filters');
    const runs = options.runs ?? suite.runs ?? 3;

    process.stdout.write(`\n## ${suite.name}: ${suite.description}\n\n`);
    const outDir = mkdtempSync(join(tmpdir(), `bench-${suite.name}-`));
    try {
        const bundle = await bundleEntry(suite.entry, outDir);
        const results: CaseResult[] = [];
        for (let i = 0; i < cases.length; i++) {
            const result = runCase(bundle, suite, cases[i], runs);
            if (result !== undefined) results.push(result);
        }
        const markdown = formatTables(suite, results, runs);
        process.stdout.write(`\n${markdown}\n`);
        if (options.save) save(suite, results, runs, markdown);
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
    const path = join(BENCHMARKS_DIR, 'results', `${suite.name}.json`);
    const saved = JSON.parse(readFileSync(path, 'utf8')) as SavedResults;
    const markdown = formatTables(suite, saved.results, saved.runs);
    writeMarkdown(suite, saved.environment, markdown);
    process.stdout.write(`${markdown}\n\nRewrote benchmarks/results/${suite.name}.md\n`);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface SavedResults {
    readonly environment: Record<string, string>;
    readonly runs: number;
    readonly results: CaseResult[];
}

const BENCHMARKS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_DIR = resolve(BENCHMARKS_DIR, '..');

function matches(params: Readonly<Record<string, ParamValue>>, filters: Readonly<Record<string, string>>): boolean {
    for (const key in filters) {
        if (String(params[key]) !== filters[key]) return false;
    }
    return true;
}

async function bundleEntry(entry: string, outDir: string): Promise<string> {
    const outfile = join(outDir, 'case.mjs');
    await build({
        entryPoints: [join(BENCHMARKS_DIR, 'suites', entry)],
        outfile,
        bundle: true,
        platform: 'node',
        format: 'esm',
        logLevel: 'warning',
        // Node resolves solid-js to its server build, where effects never run
        alias: { 'solid-js': join(REPO_DIR, 'node_modules/solid-js/dist/solid.js') },
        // Measure what a production build runs: Vite would replace these
        define: { 'import.meta.env': '{"DEV":false,"PROD":true,"MODE":"production","BASE_URL":"/"}' },
        plugins: [stubTextureRegistry],
    });
    return outfile;
}

/**
 * Loading a spritesheet needs a browser. For the games suite, every texture
 * becomes Pixi's 1x1 `Texture.WHITE`: models do not read textures, and the
 * benchmarks exclude rendering, so this changes only what would be drawn.
 */
const stubTextureRegistry: Plugin = {
    name: 'stub-texture-registry',
    setup(pluginBuild) {
        pluginBuild.onLoad({ filter: /[\\/]common[\\/]texture-registry\.ts$/ }, () => ({
            loader: 'ts',
            resolveDir: join(REPO_DIR, 'src/common'),
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

function runCase(bundle: string, suite: Suite, testCase: Case, runs: number): CaseResult | undefined {
    const label = describeParams(testCase.params);
    process.stdout.write(`${label} ...`);
    const nodeArgs = [...(suite.nodeArgs ?? []), ...(testCase.nodeArgs ?? [])];
    const metrics: Record<string, number[]> = {};
    for (let r = 0; r < runs; r++) {
        const child = spawnSync(
            process.execPath,
            [...nodeArgs, bundle, JSON.stringify(testCase.params)],
            { encoding: 'utf8' },
        );
        if (child.status !== 0) {
            process.stdout.write(` failed\n${child.stderr}\n`);
            process.exitCode = 1;
            return undefined;
        }
        const lines = child.stdout.trim().split('\n');
        const reported = JSON.parse(lines[lines.length - 1]) as Record<string, number>;
        for (const key in reported) {
            (metrics[key] ??= []).push(reported[key]);
        }
        process.stdout.write(` ${formatMetrics(reported)}`);
    }
    process.stdout.write('\n');
    for (const key in metrics) metrics[key].sort((a, b) => a - b);
    return { params: testCase.params, metrics };
}

function formatTables(suite: Suite, results: CaseResult[], runs: number): string {
    const sections: string[] = [];
    for (let t = 0; t < suite.tables.length; t++) {
        const table = formatTable(suite, suite.tables[t], results, runs);
        if (table !== undefined) sections.push(table);
    }
    return sections.join('\n\n');
}

function formatTable(suite: Suite, spec: TableSpec, results: CaseResult[], runs: number): string | undefined {
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
            const cells = metrics.map((m) => formatCell(rows[r].metrics[m.key], m.maxDecimals));
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
                lines.push(`| ${[...rowLabels(rows[r]), formatCell(rows[r].metrics[metric], spec.maxDecimals)].join(' | ')} |`);
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
                    return result === undefined ? '' : formatCell(result.metrics[metric], spec.maxDecimals);
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

function describeCells(runs: number): string {
    return `median of ${runs} runs, each in its own process; ± marks runs that disagreed by more than ${SPREAD_SHOWN_ABOVE_PERCENT}%`;
}

/**
 * The median, then half the spread between the lowest and highest run as a
 * share of the median, when that is more than 5%: `3.8 ±40%`. Smaller spreads,
 * and medians that round to zero, show just the value.
 */
function formatCell(values: number[], maxDecimals = 2): string {
    const median = values[Math.floor(values.length / 2)];
    const low = values[0];
    const high = values[values.length - 1];
    const shown = formatNumber(median, maxDecimals);
    if (shown === '0') return shown;
    const spread = Math.round(((high - low) / 2 / median) * 100);
    if (spread <= SPREAD_SHOWN_ABOVE_PERCENT) return shown;
    return `${shown} ±${spread}%`;
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

function save(suite: Suite, results: CaseResult[], runs: number, markdown: string): void {
    const dir = join(BENCHMARKS_DIR, 'results');
    mkdirSync(dir, { recursive: true });
    const environment = describeEnvironment();
    writeFileSync(join(dir, `${suite.name}.json`), `${JSON.stringify({ suite: suite.name, environment, runs, results }, undefined, 4)}\n`);
    writeMarkdown(suite, environment, markdown);
    process.stdout.write(`\nSaved benchmarks/results/${suite.name}.json and .md\n`);
}

function writeMarkdown(suite: Suite, environment: Record<string, string>, markdown: string): void {
    const header = [
        `<!-- Generated by \`npm run bench -- ${suite.name} --save\`. Do not edit by hand. -->`,
        '',
        `<!-- #region environment -->`,
        `Measured ${environment.date} on ${environment.cpu}, ${environment.os}, Node.js ${environment.node} (V8 ${environment.v8}), pixi.js ${environment.pixi}, solid-js ${environment.solid}.`,
        `<!-- #endregion environment -->`,
    ].join('\n');
    writeFileSync(join(BENCHMARKS_DIR, 'results', `${suite.name}.md`), `${header}\n\n${markdown}\n`);
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
