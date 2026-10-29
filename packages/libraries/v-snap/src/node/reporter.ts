/**
 * The reporter that prints the visual tests' summary, after Vitest's own
 * summary. Each `vsnap` call has one, which reports on its own projects
 * only. It says how many actual images were produced and how they compared.
 * It says how long the tests took, as the median and 95th percentile for
 * each kind of test, and lists the slowest. It also says how much space the
 * references take, and lists the largest. That way, a slow test or a big
 * reference is noticed when it is added. On GitHub, the summary also goes on
 * the job's summary page.
 *
 * After each run, the reporter also looks for references that no actual
 * image was compared with, which tests that were renamed or deleted left
 * behind. A run that writes references, by default outside CI, deletes
 * them, as it writes new ones. In CI, it lists them and fails the run. It
 * also checks that no tests in two files share a reference image.
 *
 * The other checks of the references fail tests, so that they show
 * wherever test failures do: a test fails if its reference's pixels don't
 * match the hash it carries, or if another test of its file has the same
 * image name. A check here isn't a test, so a failure is printed under a
 * heading of its own, after the summary, and sets the exit code, as Vitest's
 * coverage thresholds do. Vitest's own summary, its UI and its other
 * reporters don't show it. In GitHub Actions, it is also an error
 * annotation.
 */

import { appendFileSync, existsSync, rmSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { Reporter, TestModule, TestRunEndReason, Vitest } from 'vitest/node';
import { toImageName } from '../image-name.ts';
import type { VisualTestMeta } from '../protocol.ts';
import type { VisualRunState } from './commands.ts';
import { resolveReferencePath, type VisualLayout } from './layout.ts';
import { DRAWS_EXACTLY } from './compare.ts';
import { createPaint, isColourOn, type Paint } from './paint.ts';
import { shortenPath, toDisplayPath, toOutputBase } from './paths.ts';
import { findOrphans, findReferences, findReferencesOfFiles, listTrackedFiles, removeReference, toFileKey } from './references.ts';
import { describeProblems, forgetVsnapCalls, type VisualTestFiles } from './test-files.ts';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the reporter for one `vsnap` call's projects. */
export function createVisualReporter(options: {
    readonly layout: VisualLayout;
    readonly state: VisualRunState;
    /** The names of the projects to report on. */
    readonly projectNames: readonly string[];
    /** Every visual test file of those projects, as absolute paths. */
    readonly testFiles: readonly string[];
    /** The files that match the globs but can't run, which fail every run of the projects. */
    readonly problems: VisualTestFiles['problems'];
}): Reporter {
    const { layout, state, projectNames } = options;
    /** The files whose reference images are this reporter's: its test files, and those that can't run yet, as absolute paths. */
    const ownFiles = [...options.testFiles, ...options.problems.map((p) => resolve(layout.root, p.file))];
    let vitest: Vitest | undefined;
    /** When the run's first visual test file started, for the summary's time. */
    let started: number | undefined;
    /** Whether a run of the projects has ended, so that the next run in watch mode is a rerun. */
    let hasRun = false;
    return {
        onInit(v: Vitest) {
            vitest = v;
        },
        onTestRunStart() {
            started = undefined;
            state.cdpSessions.clear();
        },
        onServerRestart() {
            // Vitest loads the config again, whose vsnap calls may have new
            // names or globs.
            forgetVsnapCalls();
        },
        onTestModuleStart(module: TestModule) {
            if (projectNames.includes(module.project.name)) started ??= performance.now();
        },
        onTestRunEnd(allModules: readonly TestModule[], _errors: readonly unknown[], reason: TestRunEndReason) {
            const testModules = allModules.filter((m) => projectNames.includes(m.project.name));
            if (testModules.length === 0 || vitest === undefined) return;
            // The checks run once the run's files have ended. They fail the run
            // through its exit code, which Vitest leaves as they set it.
            const failures = options.problems.length > 0 ? [describeProblems(options.problems)] : [];
            const isRerun = hasRun && vitest.config.watch;
            hasRun = true;
            const outcome = reason === 'interrupted' ? undefined : runChecks({ layout, state, vitest, testFiles: options.testFiles, ownFiles, testModules, isRerun });
            clearPassedOutputs(layout, testModules);
            failures.push(...(outcome?.failures ?? []));
            const seconds = (performance.now() - (started ?? performance.now())) / 1000;
            const run = { projectNames, testModules, outcome, seconds, layout };
            const stream = selectStream(vitest);
            // In a terminal, each row fits its width.
            const lines = describeRun({ ...run, paint: createPaint(isColourOn(stream)), columns: stream.isTTY ? stream.columns : undefined });
            if (lines.length > 0) stream.write(`\n${lines.join('\n')}\n`);
            const summary = process.env.GITHUB_STEP_SUMMARY;
            if (summary !== undefined && summary !== '' && lines.length > 0) {
                appendFileSync(summary, `\`\`\`\n${describeRun({ ...run, paint: createPaint(false), columns: undefined }).join('\n')}\n\`\`\`\n`);
            }
            if (failures.length > 0) failRun(vitest, failures);
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The words for each outcome in the summary, and whether it passed. */
const OUTCOMES: Readonly<Record<string, { readonly word: string; readonly isPass: boolean }>> = {
    'same': { word: 'identical', isPass: true },
    'within-tolerance': { word: 'within tolerance', isPass: true },
    'added': { word: 'added', isPass: true },
    'updated': { word: 'updated', isPass: true },
    'differs': { word: 'differ', isPass: false },
    'size': { word: 'changed size', isPass: false },
    'new': { word: 'new', isPass: false },
    'case': { word: 'named in another case', isPass: false },
    'unsound': { word: 'with a wrong hash', isPass: false },
};

/** One actual image of the run, for the summary. */
interface RunImage {
    /** The test's file, relative to the project's root, such as `src/hud/visual-tests/hud-view.test.tsx`. */
    readonly file: string;
    /** The test's full name, such as `at the start`. */
    readonly name: string;
    /** The test's reference image, as an absolute path. */
    readonly reference: string;
    readonly meta: VisualTestMeta;
    /** The test's time, in milliseconds. */
    readonly total: number;
}

/**
 * Returns the summary's lines, laid out as Vitest's own summary is: a
 * heading, a table of the actual images, the tests' times and the
 * references, then a section for each list, such as the new references and
 * the slowest tests. A run that didn't run every visual test file, such as
 * a rerun in watch mode, gets a short summary, without the slowest tests and
 * the largest references.
 */
function describeRun(options: {
    readonly projectNames: readonly string[];
    readonly testModules: readonly TestModule[];
    readonly outcome: CheckOutcome | undefined;
    /** How long the visual test files took, from the first one's start. */
    readonly seconds: number;
    readonly layout: VisualLayout;
    readonly paint: Paint;
    /** The terminal's width, which each row fits, or undefined for rows of any length. */
    readonly columns: number | undefined;
}): string[] {
    const { outcome, paint, columns } = options;
    const root = options.layout.root;
    const notes = outcome?.notes ?? ['The reference images were not checked, and no unused ones were looked for, because the run was interrupted.'];
    const deleted = outcome?.deleted ?? [];
    const images = listImages(options.layout, options.testModules);
    const unjudged = countUnjudged(options.testModules);
    if (images.length === 0 && unjudged === 0 && notes.length === 0 && deleted.length === 0 && outcome?.unused === undefined) return [];
    const lines = [` ${paint.badge(' v-snap ')} ${paint.dim(options.projectNames.join(', '))}`];
    const rows: (readonly [string, string])[] = [];
    if (images.length > 0 || unjudged > 0) rows.push(['Images', describeOutcomes(images, unjudged, paint)]);
    if (images.length > 0) {
        const times: string[][] = [];
        for (const pageKind of ['canvas', 'html'] as const) {
            const sorted = images.filter((p) => p.meta.pageKind === pageKind).map((p) => p.total).sort((a, b) => a - b);
            if (sorted.length === 0) continue;
            const high = sorted.length === 1 ? ['', ''] : ['95th percentile', `${formatPercentile(sorted, 0.95)} ms`];
            times.push([pageKind === 'canvas' ? 'Canvas tests' : 'HTML tests', String(sorted.length), 'median', `${formatPercentile(sorted, 0.5)} ms`, ...high]);
        }
        for (const [label, n, ...cells] of alignColumns(times, ['start', 'end', 'start', 'end', 'start', 'end'])) {
            rows.push([label.trim(), `${n}   ${paint.dim(cells[0])} ${cells[1]}   ${paint.dim(cells[2])} ${cells[3]}`.trimEnd()]);
        }
    }
    if (outcome?.isComplete === true && outcome.references.length > 0) {
        const bytes = outcome.references.reduce((sum, r) => sum + r.bytes, 0);
        rows.push(['References', `${count(outcome.references.length, 'file')}, ${formatKilobytes(bytes)}`]);
    }
    if (images.length > 0) rows.push(['Duration', options.seconds < 1 ? `${Math.round(options.seconds * 1000)} ms` : `${options.seconds.toFixed(1)} s`]);
    const width = Math.max(...rows.map(([label]) => label.length));
    lines.push('', ...rows.map(([label, value]) => ` ${paint.dim(label.padStart(width))}  ${value}`));
    if (notes.length > 0) lines.push('', ...notes.map((note) => ` ${paint.dim(note)}`));
    const added = images.filter((p) => p.meta.outcome === 'added');
    if (added.length > 0) {
        lines.push(...describeSection(paint, {
            title: 'New references',
            note: 'Look at each before committing it.',
            rows: added.map((p) => fitRow({ paint, columns, path: toRootPath(root, p.reference) })),
        }));
    }
    if (deleted.length > 0) {
        lines.push(...describeSection(paint, { title: 'Deleted references', rows: deleted.map((file) => fitRow({ paint, columns, path: toRootPath(root, file) })) }));
    }
    const unused = outcome?.unused;
    if (unused !== undefined) {
        lines.push(...describeSection(paint, {
            title: 'Unused references',
            note: `No test uses these, but they were kept. ${unused.why}`,
            rows: unused.files.map((file) => fitRow({ paint, columns, path: toRootPath(root, file) })),
        }));
    }
    if (images.some((p) => p.meta.outcome === 'within-tolerance')) {
        const why = DRAWS_EXACTLY
            ? "This processor draws exactly, so each is a small change, or a reference written on arm64, and Vitest's -u rewrites it."
            : 'arm64 processors round some drawing so, and Vitest\'s -u leaves those references as they are.';
        lines.push('', ` ${paint.dim(`Images within tolerance matched their references closely, but not exactly. ${why}`)}`);
    }
    // The downsampled references come last, after the slowest tests and the
    // largest references of a complete run.
    const reduced = images.filter((p) => p.meta.resolution < 1);
    const downsampled = reduced.length === 0
        ? []
        : describeSection(paint, {
                title: 'Downsampled references',
                rows: alignColumns(reduced.map((p) => [`1/${1 / p.meta.resolution}`, formatSize(p.meta)]), ['start', 'end'])
                    .map((cells, i) => fitTestRow({ paint, columns, cells: `${cells.join('   ')}   `, image: reduced[i] })),
            });
    if (outcome?.isComplete !== true) return [...lines, ...downsampled];
    const slowest = [...images].sort((a, b) => b.total - a.total).slice(0, 5);
    if (slowest.length > 0) {
        const rows = alignColumns(slowest.map((p) => [`${p.total.toFixed(1)} ms`, formatSize(p.meta)]), ['end', 'end']);
        const title = images.length > slowest.length ? 'Slowest tests' : 'Tests';
        lines.push(...describeSection(paint, { title, rows: rows.map((cells, i) => fitTestRow({ paint, columns, cells: `${cells.join('   ')}   `, image: slowest[i] })) }));
    }
    const largest = [...outcome.references].sort((a, b) => b.bytes - a.bytes).slice(0, 3);
    if (largest.length > 0) {
        const title = outcome.references.length > largest.length ? 'Largest references' : 'References';
        const rows = alignColumns(largest.map((r) => [formatKilobytes(r.bytes)]), ['end']);
        lines.push(...describeSection(paint, { title, rows: rows.map((cells, i) => fitRow({ paint, columns, cells: `${cells[0]}   `, path: toRootPath(root, largest[i].file) })) }));
    }
    return [...lines, ...downsampled];
}

/** Returns the run's actual images, each with its test's file and name, since two files' tests can share a name. */
function listImages(layout: VisualLayout, testModules: readonly TestModule[]): RunImage[] {
    const images: RunImage[] = [];
    for (const module of testModules) {
        for (const test of module.children.allTests()) {
            const record = test.meta().vsnap;
            if (record?.result === undefined) continue;
            let total = 0;
            for (const ms of Object.values(record.result.ms)) total += ms;
            images.push({
                file: toRootPath(layout.root, module.moduleId),
                name: test.fullName,
                reference: resolveReferencePath(layout, module.moduleId, record.image),
                meta: record.result,
                total,
            });
        }
    }
    return images;
}

/**
 * Returns the number of visual tests that failed before their image was
 * judged, such as one whose pose threw, or whose view drew nothing.
 */
function countUnjudged(testModules: readonly TestModule[]): number {
    let n = 0;
    for (const module of testModules) {
        for (const test of module.children.allTests()) {
            const record = test.meta().vsnap;
            if (record !== undefined && record.result === undefined && test.result().state === 'failed') n++;
        }
    }
    return n;
}

/**
 * Returns how the images compared, such as `33 identical | 2 differ (35)`,
 * each outcome coloured by whether it passed, and the tests that failed
 * before their image was judged.
 */
function describeOutcomes(images: readonly RunImage[], unjudged: number, paint: Paint): string {
    const counts = new Map<string, number>();
    for (const p of images) counts.set(p.meta.outcome, (counts.get(p.meta.outcome) ?? 0) + 1);
    const parts = [...counts].map(([name, n]) => {
        const outcome = OUTCOMES[name];
        const text = `${n} ${outcome?.word ?? name}`;
        return outcome?.isPass === false ? paint.bold(paint.red(text)) : paint.bold(paint.green(text));
    });
    if (unjudged > 0) parts.push(paint.bold(paint.red(`${unjudged} failed before comparing`)));
    return `${parts.join(paint.dim(' | '))} ${paint.dim(`(${images.length + unjudged})`)}`;
}

/** The indent of a section's rows. */
const ROW_INDENT = '   ';

/**
 * Returns a section's row: its cells, which are plain text, then a path,
 * then the rest. In a terminal, the path is shortened in the middle, if the
 * row would be wider than the terminal, so that the row doesn't wrap.
 */
function fitRow(options: {
    readonly paint: Paint;
    readonly columns: number | undefined;
    readonly cells?: string;
    readonly path: string;
    /** What follows the path, as plain text and as it is shown. */
    readonly rest?: { readonly text: string; readonly shown: string };
    readonly isPathDim?: boolean;
}): string {
    const cells = options.cells ?? '';
    const rest = options.rest ?? { text: '', shown: '' };
    // The last column is left empty, since some terminals wrap a full line.
    const room = options.columns === undefined ? Infinity : options.columns - 1 - ROW_INDENT.length - cells.length - rest.text.length;
    const path = shortenPath(options.path, room);
    return `${cells}${options.isPathDim === true ? options.paint.dim(path) : path}${rest.shown}`;
}

/** Returns a section's row about a test: its cells, then its file and name, as `file > name`, the file shortened to fit. */
function fitTestRow(options: { readonly paint: Paint; readonly columns: number | undefined; readonly cells: string; readonly image: RunImage }): string {
    const { paint, image } = options;
    const rest = { text: ` > ${image.name}`, shown: `${paint.dim(' >')} ${image.name}` };
    return fitRow({ paint, columns: options.columns, cells: options.cells, path: image.file, rest, isPathDim: true });
}

/** Returns a file's path relative to the project's root, with forward slashes, as Vitest shows its test files. */
function toRootPath(root: string, file: string): string {
    return relative(root, file).replaceAll('\\', '/');
}

/** Returns a section of the summary: a blank line, its title, a note that explains it, if any, and its rows, indented. */
function describeSection(paint: Paint, section: { readonly title: string; readonly note?: string; readonly rows: readonly string[] }): string[] {
    const note = section.note === undefined ? [] : [` ${paint.dim(section.note)}`];
    return ['', ` ${paint.bold(section.title)}`, ...note, ...section.rows.map((row) => `${ROW_INDENT}${row}`)];
}

/** Returns the rows with each column padded to its widest cell, at the end or the start, so that the columns line up. */
function alignColumns(rows: readonly (readonly string[])[], sides: readonly ('start' | 'end')[]): string[][] {
    const widths = sides.map((_, i) => Math.max(0, ...rows.map((row) => row[i].length)));
    return rows.map((row) => row.map((cell, i) => sides[i] === 'end' ? cell.padStart(widths[i]) : cell.padEnd(widths[i])));
}

/** Returns an image's size, such as `480x303`. */
function formatSize(meta: VisualTestMeta): string {
    return `${meta.width}x${meta.height}`;
}

/**
 * Fails the run over v-snap's own checks, as Vitest's coverage thresholds
 * fail it: it prints what failed, under a heading of its own, and sets the
 * exit code. They aren't test failures, nor errors that Vitest caught, so
 * they don't go through either. In GitHub Actions, each also becomes an
 * error annotation.
 */
function failRun(vitest: Vitest | undefined, failures: readonly string[]): void {
    const stream = selectStream(vitest);
    const paint = createPaint(isColourOn(stream));
    const blocks = failures.map((failure) => {
        const [heading, ...rest] = failure.split('\n');
        return [` ${paint.bold(heading)}`, ...rest.map((line) => ` ${line}`)].join('\n');
    });
    stream.write(`\n ${paint.failBadge(' FAIL ')} ${paint.red("v-snap's checks of the reference images failed, so the run fails.")}\n\n${blocks.join('\n\n')}\n`);
    if (process.env.GITHUB_ACTIONS === 'true') {
        for (const failure of failures) console.error(`::error title=v-snap::${failure.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
    }
    process.exitCode = 1;
}

/** The outcomes of an image that passed. */
const PASSED: ReadonlySet<string> = new Set(['same', 'within-tolerance', 'added', 'updated']);

/**
 * Deletes the actual and diff images that earlier runs wrote for the tests
 * whose images passed in this run, so that `.vitest/vsnap/` holds only those
 * of tests that fail now. A failed test's are kept, since they were just
 * written.
 */
function clearPassedOutputs(layout: VisualLayout, testModules: readonly TestModule[]): void {
    for (const module of testModules) {
        for (const test of module.children.allTests()) {
            const record = test.meta().vsnap;
            if (record?.result === undefined || !PASSED.has(record.result.outcome)) continue;
            const base = toOutputBase(resolveReferencePath(layout, module.moduleId, record.image));
            for (const suffix of OUTPUT_SUFFIXES) rmSync(`${base}${suffix}`, { force: true });
        }
    }
}

/** The ends of the names of the files that a failed test writes beside its output base. */
const OUTPUT_SUFFIXES = ['.actual.png', '.diff.png'];

/** What a run's checks found. */
interface CheckOutcome {
    /** Sentences for the summary, such as that only some files' references were checked. */
    readonly notes: readonly string[];
    /** The references that the run deleted, as unused, with `-u`, as absolute paths. */
    readonly deleted: readonly string[];
    /** The unused references that the run kept, and why, if it kept any. */
    readonly unused?: UnusedReferences;
    /** The checks that failed, each a heading and its lines. */
    readonly failures: readonly string[];
    /** The references that the checks covered, with their sizes, found once for the summary too. */
    readonly references: readonly { readonly file: string; readonly bytes: number }[];
    /** Whether every visual test file ran and loaded, so that the checks covered every reference, those of deleted test files too. */
    readonly isComplete: boolean;
}

/** What a check found: its failure, if it failed, and the references it deleted or kept, if any. */
interface CheckResult {
    readonly failure?: string;
    readonly deleted?: readonly string[];
    readonly unused?: UnusedReferences;
}

/** Unused references that a run that writes references kept, as absolute paths, and why it kept them. */
interface UnusedReferences {
    readonly files: readonly string[];
    readonly why: string;
}

/**
 * Runs the checks of the references, once every test file of the run has
 * ended, and returns what they found.
 *
 * - Tests in two files that share a reference fail the run. Two tests of
 *   one file that share one fail the second test instead, in the page.
 * - References that no test uses are deleted by a run that writes
 *   references: by default outside CI, as a new reference is written, and
 *   with `-u`, if git tracks them and the run isn't a rerun in watch mode
 *   (see `settleOrphans`). In CI, they are listed, and fail the run. A test
 *   that didn't run, because it was skipped or a filter left it out, still
 *   uses its reference, by its name.
 *
 * Each reference's pixels are checked against the hash it carries by its
 * own test, which fails if they don't match, so that the failure shows
 * wherever test failures do.
 *
 * A run of every visual test file covers every reference, those of deleted
 * test files too. A run of some of them, such as a shard, a run of one file
 * or a rerun in watch mode, covers the references of the files that ran.
 */
function runChecks(options: {
    readonly layout: VisualLayout;
    readonly state: VisualRunState;
    readonly vitest: Vitest;
    /** Every visual test file of the projects, as absolute paths. */
    readonly testFiles: readonly string[];
    /** The files whose reference images are the projects', as absolute paths. */
    readonly ownFiles: readonly string[];
    /** The test modules of the projects that ran. */
    readonly testModules: readonly TestModule[];
    /** Whether the run is a rerun in watch mode. */
    readonly isRerun: boolean;
}): CheckOutcome {
    const { layout, state, vitest } = options;
    // Unused references go as new ones arrive: outside CI, and with -u.
    const update = vitest.config.snapshotOptions.updateSnapshot;
    const isWriting = update === 'all' || update === 'new' || process.env.VSNAP_MODE === 'environment';
    // A rerun in watch mode follows each save, so a test commented out for a
    // moment would lose its reference. It deletes only when told to update.
    const mayDelete = !options.isRerun || update === 'all';
    // A file that failed to load has no tests to say which references it uses.
    const loaded = options.testModules.filter((m) => m.errors().length === 0);
    const loadedKeys = new Set(loaded.map((m) => toFileKey(m.moduleId)));
    const ran = new Set(options.testModules.map((m) => toFileKey(m.moduleId)));
    const notRun = options.testFiles.filter((file) => !ran.has(toFileKey(file))).length;
    const isComplete = notRun === 0 && loaded.length === options.testModules.length;
    const others = options.ownFiles.filter((file) => !loadedKeys.has(toFileKey(file)));
    const covered = loaded.map((m) => m.moduleId);
    const references = isComplete ? findReferences(layout, options.ownFiles) : findReferencesOfFiles(layout, covered, others);
    const used = listUsedReferences(layout, options.testModules);
    const named = listNamedReferences(layout, loaded);
    const results = [
        describeSharedReferences(used),
        settleOrphans({ layout, state, references: references.map((r) => r.file), used, named, isWriting, mayDelete }),
    ];
    const notes: string[] = [];
    const failures = results.flatMap((result) => result.failure === undefined ? [] : [result.failure]);
    const deleted = results.flatMap((result) => result.deleted ?? []);
    const unused = results.find((result) => result.unused !== undefined)?.unused;
    for (const module of options.testModules) {
        if (!loadedKeys.has(toFileKey(module.moduleId))) notes.push(`${toDisplayPath(module.moduleId)} failed to load, so its references were not checked.`);
    }
    if (!isComplete && loaded.length > 0) {
        const files = loaded.length === 1 ? 'the visual test file' : `the ${loaded.length} visual test files`;
        notes.push(`Only the references of ${files} that ran were looked at for unused ones. A run of every visual test file looks at them all, those of deleted test files too.`);
    }
    // The references that the run deleted are gone, so the summary leaves them out.
    const kept = deleted.length === 0 ? references : references.filter((r) => existsSync(r.file));
    return { notes, deleted, unused, failures, references: kept, isComplete };
}

/**
 * Returns the stream for the summary. It is standard error when one of the
 * run's reporters writes machine-readable output to standard output, such
 * as Vitest's JSON reporter with no output file, so that the summary doesn't
 * corrupt it.
 */
function selectStream(vitest: Vitest | undefined): NodeJS.WriteStream {
    return vitest !== undefined && writesMachineOutput(vitest) ? process.stderr : process.stdout;
}

/** Returns whether one of the run's reporters writes machine-readable output to standard output. */
function writesMachineOutput(vitest: Vitest): boolean {
    const outputFile = vitest.config.outputFile;
    for (const reporter of vitest.config.reporters as unknown[]) {
        const name = Array.isArray(reporter) ? reporter[0] : reporter;
        if (typeof name !== 'string' || !MACHINE_REPORTERS.has(name)) continue;
        const hasFile = typeof outputFile === 'string' || (typeof outputFile === 'object' && outputFile !== null && name in outputFile);
        if (!hasFile) return true;
    }
    return false;
}

/** Vitest's reporters whose output is for programs, not people. */
const MACHINE_REPORTERS: ReadonlySet<string> = new Set(['json', 'junit', 'tap', 'tap-flat']);

/**
 * A reference, and the full names of the tests that used it in this run.
 * Paths that differ only in case are one reference, since they are one file
 * on macOS and Windows, so it can have more than one path.
 */
interface UsedReference {
    readonly file: string;
    /** Every path that the tests gave the reference, which differ only in case. */
    readonly files: Set<string>;
    readonly tests: string[];
    /** The test files whose tests used it, by their file keys. */
    readonly modules: Set<string>;
}

/** Returns the references that this run's tests used, by their paths in lower case. */
function listUsedReferences(layout: VisualLayout, testModules: readonly TestModule[]): Map<string, UsedReference> {
    const used = new Map<string, UsedReference>();
    for (const module of testModules) {
        for (const test of module.children.allTests()) {
            const imageName = test.meta().vsnap?.image;
            if (imageName === undefined) continue;
            const file = resolveReferencePath(layout, module.moduleId, imageName);
            const key = resolve(file).toLowerCase();
            const entry = used.get(key) ?? { file, files: new Set<string>(), tests: [], modules: new Set<string>() };
            entry.files.add(file);
            entry.tests.push(test.fullName);
            entry.modules.add(toFileKey(module.moduleId));
            used.set(key, entry);
        }
    }
    return used;
}

/**
 * Returns the summary's lines about references that tests in two or more
 * files share, and a failure if there are any. That happens when two files
 * whose references are in one folder, by a reference path without the test
 * file's stem, have tests with the same image names. Names that differ only
 * in case share one too, on every system, since macOS and Windows keep them
 * in one file. Two tests of one file that share a reference fail the
 * second test instead, in the page.
 */
function describeSharedReferences(used: ReadonlyMap<string, UsedReference>): CheckResult {
    const lines: string[] = [];
    for (const { file, files, tests, modules } of used.values()) {
        if (modules.size < 2) continue;
        const caseNote = files.size > 1 ? ' (their names differ only in case, which macOS and Windows keep in one file)' : '';
        lines.push(`  ${toDisplayPath(file)}: ${tests.map((t) => `'${t}'`).join(', ')}${caseNote}`);
    }
    if (lines.length === 0) return {};
    const heading = 'These tests share a reference image, so each would overwrite the others. Rename all but one of each group:';
    return { failure: [heading, ...lines].join('\n') };
}

/**
 * Returns the references of the tests that didn't record an image in this
 * run, by their names, as file keys: tests that were skipped, by `.skip`,
 * `.only`, `.todo` or a filter such as `-t`, and tests that failed before
 * their image was named. Each one still uses its reference. A test that
 * isn't a visual test gives a path that no reference has.
 */
function listNamedReferences(layout: VisualLayout, testModules: readonly TestModule[]): Set<string> {
    const named = new Set<string>();
    for (const module of testModules) {
        for (const test of module.children.allTests()) {
            if (test.meta().vsnap !== undefined) continue;
            let imageName: string;
            try {
                imageName = toImageName(test.fullName);
            }
            catch {
                // A name with no letters or digits has no image.
                continue;
            }
            named.add(toFileKey(resolveReferencePath(layout, module.moduleId, imageName)));
        }
    }
    return named;
}

/**
 * Handles the references that no test used. A run that writes references,
 * by default outside CI, deletes them, as it writes new ones, so that a
 * renamed test leaves nothing behind. In CI, it lists them, with a failure.
 *
 * A deletion must be one that can be undone, so a run deletes only the
 * references that git tracks, which git can bring back. A reference that
 * is new, and not yet added to git, is kept, and so is every reference if
 * git can't say which it tracks. A rerun in watch mode deletes none, unless
 * it updates references, since it follows each save. The summary lists the
 * references that were kept, and why.
 */
function settleOrphans(options: {
    readonly layout: VisualLayout;
    readonly state: VisualRunState;
    /** The references that the checks cover, as absolute paths. */
    readonly references: readonly string[];
    readonly used: ReadonlyMap<string, UsedReference>;
    /** The references of the tests that recorded no image, as file keys. */
    readonly named: ReadonlySet<string>;
    /** Whether the run writes references, and so deletes unused ones. */
    readonly isWriting: boolean;
    /** Whether the run may delete them: not a rerun in watch mode, unless it updates references. */
    readonly mayDelete: boolean;
}): CheckResult {
    const compared = [...options.state.calibrationReferences, ...[...options.used.values()].flatMap((u) => [...u.files])];
    const orphans = findOrphans({ references: options.references, compared }).filter((file) => !options.named.has(toFileKey(file)));
    if (orphans.length === 0) return {};
    if (!options.isWriting) {
        const it = orphans.length === 1 ? 'it' : 'them';
        const heading = `No test uses ${countReferences(orphans.length, 'this', 'these')}. Tests that were renamed or deleted left ${it} behind. `
            + `This run writes no references, as in CI, so it doesn't delete ${it}. A run outside CI, or with Vitest's -u, deletes ${it}:`;
        return { failure: [heading, ...orphans.map((file) => `  ${toDisplayPath(file)}`)].join('\n') };
    }
    if (!options.mayDelete) {
        return { unused: { files: orphans, why: RERUN_KEEPS } };
    }
    const tracked = listTrackedFiles(options.layout.root);
    const deleted = tracked === undefined ? [] : orphans.filter((file) => tracked.has(toFileKey(file)));
    for (const file of deleted) removeReference(file, options.layout.root);
    if (deleted.length === orphans.length) return { deleted };
    return { deleted, unused: { files: orphans.filter((file) => !deleted.includes(file)), why: tracked === undefined ? NO_GIT_KEEPS : UNTRACKED_KEEPS } };
}

/** Why a rerun in watch mode kept the unused references. */
const RERUN_KEEPS = 'A rerun in watch mode deletes none, since a test may be commented out for only a moment. '
    + 'A run that isn\'t a rerun deletes the ones that git tracks, and so does pressing u to update.';

/** Why a run kept unused references that git doesn't track. */
const UNTRACKED_KEEPS = 'Git doesn\'t track them, so their deletion couldn\'t be undone. Delete them by hand, or add them to git, and the next run deletes them.';

/** Why a run kept every unused reference, when git couldn't say which it tracks. */
const NO_GIT_KEEPS = 'Git couldn\'t say which references it tracks, so their deletion might not be undone. Delete them by hand.';

/** Returns a count and its noun, such as '1 actual image' or '3 actual images'. */
function count(n: number, noun: string): string {
    return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** Returns 'this reference' or 'these 3 references'. */
function countReferences(count: number, one: string, many: string): string {
    return count === 1 ? `${one} reference` : `${many} ${count} references`;
}

function formatKilobytes(bytes: number): string {
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatPercentile(sorted: readonly number[], fraction: number): string {
    return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))].toFixed(1);
}
