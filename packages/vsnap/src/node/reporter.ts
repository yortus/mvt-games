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
 * After a complete run, in which every visual test ran, the reporter does
 * two more things. It decodes every reference image, and checks its pixels
 * against the hash it carries. A run compares only the hashes, so this is
 * what catches a reference whose pixels were edited without its hash. It
 * also looks for references that no actual image was compared with, which
 * tests that were renamed or deleted left behind. Without Vitest's `-u`, it
 * lists them and fails the run. With it, it deletes them.
 *
 * After every run, it also checks that no two tests share a reference
 * image, which would happen if their names differ only in punctuation. If
 * they do, it lists them and fails the run.
 *
 * These checks run as the last of the projects' test files ends, before
 * Vitest decides whether the run passed. A check that fails gives Vitest
 * an error, as a test that fails does, so the run fails in watch mode, in
 * the UI and for a program that runs Vitest, not only by its exit code.
 */

import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configDefaults } from 'vitest/config';
import type { Reporter, TestModule, TestRunEndReason, TestSpecification, Vitest } from 'vitest/node';
import type { VisualTestMeta } from '../protocol.ts';
import type { VisualRunState } from './commands.ts';
import { resolveReferencePath, type VisualLayout } from './layout.ts';
import { toDisplayPath } from './paths.ts';
import { checkReference, findOrphans, findReferenceCandidates, findReferences, removeReference, toFileKey } from './references.ts';
import { describeProblems, listVsnapProjectNames, type VisualTestFiles } from './test-files.ts';

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
    /** The `include` lists that vsnap gave its projects. */
    readonly includes: readonly string[];
    /** The setup files that vsnap gave its projects. */
    readonly setupFiles: readonly string[];
    /** The files that match the globs but can't run, which fail every run of the projects. */
    readonly problems: VisualTestFiles['problems'];
}): Reporter {
    const { layout, state, projectNames } = options;
    const testFiles = options.testFiles.map(toFileKey);
    /** The files whose reference images are this reporter's: its test files, and those that can't run yet, as absolute paths. */
    const ownFiles = [...options.testFiles, ...options.problems.map((p) => resolve(layout.root, p.file))];
    let vitest: Vitest | undefined;
    let started = 0;
    /** The files of this reporter's projects that this run started. */
    let startedFiles = new Set<string>();
    /** The test modules of this reporter's projects that have ended in this run. */
    let ended: TestModule[] = [];
    /** The summary's lines from the run's checks, once they have run. */
    let checkLines: string[] | undefined;
    return {
        onInit(v: Vitest) {
            vitest = v;
            checkForInheritedLists(v, projectNames, options.includes);
            checkForInheritedSetupFiles(v, projectNames, options.setupFiles);
            checkForInheritedInstances(v, options.setupFiles);
        },
        onTestRunStart(specifications: readonly TestSpecification[]) {
            started = performance.now();
            startedFiles = new Set(specifications.filter((s) => projectNames.includes(s.project.name)).map((s) => toFileKey(s.moduleId)));
            ended = [];
            checkLines = undefined;
            state.cdpSessions.clear();
        },
        onTestModuleEnd(module: TestModule) {
            if (!projectNames.includes(module.project.name)) return;
            ended.push(module);
            // Reported as the run's first file ends: Vitest clears the run's
            // errors after it starts the run, and an error after the run ends
            // doesn't count towards its result.
            if (ended.length === 1 && options.problems.length > 0 && vitest !== undefined) {
                vitest.state.catchError(createCheckError(describeProblems(options.problems)), 'vsnap');
            }
            if (ended.length < startedFiles.size || vitest === undefined) return;
            const v = vitest;
            checkLines = runChecks({ layout, state, vitest: v, testFiles, ownFiles, startedFiles, testModules: ended });
        },
        onTestRunEnd(allModules: readonly TestModule[], _errors: readonly unknown[], reason: TestRunEndReason) {
            const testModules = allModules.filter((m) => projectNames.includes(m.project.name));
            if (testModules.length === 0) return;
            // The checks run as the last test file ends. A run that ended
            // before then, such as one that was interrupted, didn't run them
            const orphanLines = checkLines ?? [
                `  The reference images were not checked, and no unused ones were looked for, because ${reason === 'interrupted' ? 'the run was interrupted' : 'not every visual test file ended'}. A run of every visual test does both.`,
            ];
            const images: { name: string; meta: VisualTestMeta; total: number }[] = [];
            for (const module of testModules) {
                for (const test of module.children.allTests()) {
                    const meta = test.meta().visual;
                    if (meta === undefined) continue;
                    let total = 0;
                    for (const ms of Object.values(meta.ms)) total += ms;
                    images.push({ name: test.fullName, meta, total });
                }
            }
            if (images.length === 0) {
                if (orphanLines.length > 0) print(vitest, `\n${orphanLines.join('\n')}\n`);
                return;
            }
            const seconds = ((performance.now() - started) / 1000).toFixed(1);
            const lines = [`The visual tests (${projectNames.join(', ')}) produced ${count(images.length, 'actual image')} in ${seconds} s.`];
            for (const kind of ['canvas', 'html'] as const) {
                const times = images.filter((p) => p.meta.kind === kind).map((p) => p.total).sort((a, b) => a - b);
                if (times.length === 0) continue;
                const tests = count(times.length, `${kind === 'canvas' ? 'canvas' : 'HTML'} test`);
                lines.push(times.length === 1
                    ? `  ${tests} took ${formatPercentile(times, 0.5)} ms.`
                    : `  ${tests} took a median of ${formatPercentile(times, 0.5)} ms, with a 95th percentile of ${formatPercentile(times, 0.95)} ms.`);
            }
            const counts = new Map<string, number>();
            for (const p of images) counts.set(p.meta.outcome, (counts.get(p.meta.outcome) ?? 0) + 1);
            lines.push(`  Compared with ${images.length === 1 ? 'its reference' : 'their references'}, ${[...counts].map(([outcome, n]) => `${n} ${OUTCOMES[outcome] ?? outcome}`).join(', ')}.`);
            const added = images.filter((p) => p.meta.outcome === 'added');
            if (added.length > 0) {
                const one = added.length === 1;
                lines.push(`  ${count(added.length, 'new image')} ${one ? 'was' : 'were'} written as ${one ? 'its reference' : 'their references'}, as Vitest writes new snapshots. Look at ${one ? 'it' : 'each'} before committing:`);
                for (const p of added) lines.push(`    ${p.name}`);
            }
            const within = counts.get('within-tolerance') ?? 0;
            if (within > 0) lines.push(`  ${within} matched within the tolerance but not exactly. That is expected only on arm64 processors.`);
            const reduced = images.filter((p) => p.meta.resolution < 1);
            if (reduced.length > 0) {
                const one = reduced.length === 1;
                lines.push(`  ${reduced.length} smooth ${one ? 'image' : 'images'}, not pixel art, ${one ? 'was' : 'were'} over the size budget, so ${one ? 'it was' : 'they were'} rendered at a lower resolution. Any detail finer than an image pixel is averaged away. Here ${one ? 'is its scale, name and size' : 'are their scales, names and sizes'}:`);
                for (const p of reduced) lines.push(`    1/${1 / p.meta.resolution}  ${p.name}  (${p.meta.width}x${p.meta.height})`);
            }
            const slowest = [...images].sort((a, b) => b.total - a.total).slice(0, 5);
            lines.push(images.length > slowest.length ? '  These tests were the slowest:' : `  ${images.length === 1 ? 'The test' : 'The tests'} took:`);
            for (const p of slowest) lines.push(`    ${p.total.toFixed(1).padStart(7)} ms  ${p.name}  (${p.meta.width}x${p.meta.height})`);
            lines.push(...orphanLines);
            const references = findReferences(layout, ownFiles);
            const bytes = references.reduce((sum, r) => sum + r.bytes, 0);
            const largest = [...references].sort((a, b) => b.bytes - a.bytes).slice(0, 3);
            if (references.length === 1) lines.push(`  The reference is one file, taking ${formatKilobytes(bytes)}:`);
            else if (references.length > 1) lines.push(`  The references are ${references.length} files, taking ${formatKilobytes(bytes)} in all. ${references.length > largest.length ? 'These are the largest:' : 'They are:'}`);
            for (const r of largest) {
                lines.push(`    ${formatKilobytes(r.bytes).padStart(9)}  ${toDisplayPath(r.file)}`);
            }
            print(vitest, `\n${lines.join('\n')}\n`);
            const summary = process.env.GITHUB_STEP_SUMMARY;
            if (summary !== undefined && summary !== '') appendFileSync(summary, `\`\`\`\n${lines.join('\n')}\n\`\`\`\n`);
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const OUTCOMES: Readonly<Record<string, string>> = {
    'same': 'identical',
    'within-tolerance': 'within tolerance',
    'differs': 'differ',
    'new': 'new',
    'size': 'changed size',
    'updated': 'updated',
    'added': 'added',
};

/**
 * Runs the checks that need every test of the run to have ended, and returns
 * the summary's lines about them. Each check that fails gives Vitest an
 * error, which fails the run.
 */
function runChecks(options: {
    readonly layout: VisualLayout;
    readonly state: VisualRunState;
    readonly vitest: Vitest;
    /** Every visual test file of the projects, as file keys. */
    readonly testFiles: readonly string[];
    /** The files whose reference images are the projects', as absolute paths. */
    readonly ownFiles: readonly string[];
    readonly startedFiles: ReadonlySet<string>;
    readonly testModules: readonly TestModule[];
}): string[] {
    const { layout, state, vitest } = options;
    const isUpdate = vitest.config.snapshotOptions.updateSnapshot === 'all' || process.env.VSNAP_MODE === 'environment';
    const incomplete = findIncompleteness({ vitest, testFiles: options.testFiles, startedFiles: options.startedFiles, testModules: options.testModules });
    const used = listUsedReferences(layout, options.testModules);
    const results = [
        describeSharedReferences(used),
        ...(incomplete === undefined ? [settleOrphans({ layout, state, used, isUpdate, ownFiles: options.ownFiles }), checkEveryReference(layout, options.ownFiles)] : []),
    ];
    const lines: string[] = [];
    for (const result of results) {
        lines.push(...result.lines);
        if (result.failure !== undefined) vitest.state.catchError(createCheckError(result.failure), 'vsnap');
    }
    if (incomplete !== undefined) {
        lines.push(`  The reference images were not checked, and no unused ones were looked for, because ${incomplete}. A run of every visual test does both.`);
    }
    return lines;
}

/** The lines that a check adds to the summary, and the failure it gives Vitest, if it failed. */
interface CheckResult {
    readonly lines: readonly string[];
    readonly failure?: string;
}

/** Returns the error that a failed check gives Vitest. It has no stack, since the stack would only show vsnap's own code. */
function createCheckError(message: string): Error {
    const error = new Error(message);
    error.name = 'vsnap';
    error.stack = `vsnap: ${message}`;
    return error;
}

/**
 * Prints the summary. It goes to standard error when one of the run's
 * reporters writes machine-readable output to standard output, such as
 * Vitest's JSON reporter with no output file, so that the summary doesn't
 * corrupt it.
 */
function print(vitest: Vitest | undefined, text: string): void {
    if (vitest !== undefined && writesMachineOutput(vitest)) console.error(text);
    else console.log(text);
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
 * Throws if a vsnap project inherits setup files from the config that it is
 * listed in, as a project with Vitest's `extends: true` does. They would
 * run in the project's browser page, where a setup file written for Node,
 * or for a simulated DOM, fails in ways that point nowhere near the cause.
 */
function checkForInheritedSetupFiles(vitest: Vitest, projectNames: readonly string[], setupFiles: readonly string[]): void {
    const own = new Set(setupFiles.map(toFileKey));
    for (const project of vitest.projects) {
        if (!projectNames.includes(project.name)) continue;
        const extra = project.config.setupFiles.filter((file) => !own.has(toFileKey(file)));
        if (extra.length === 0) continue;
        throw new Error(
            `vsnap's project ${project.name} inherits setup files from the config (${extra.map(toDisplayPath).join(', ')}), which would run in its browser page. `
            + "Move setupFiles out of the config's test block, into the unit project, "
            + "or name the Vite config that vsnap's projects need, with vsnap({ viteConfig }).",
        );
    }
}

/**
 * Throws if a project that no `vsnap` call made runs vsnap's setup file. A
 * vsnap project inherits the config's `browser` settings (`extends: true`),
 * and Vitest adds the config's `browser.instances` to the project's own. So
 * each visual test file would run again, in a browser that vsnap didn't set
 * up, uncounted in the summary, and racing vsnap's own when it writes a new
 * reference.
 */
function checkForInheritedInstances(vitest: Vitest, setupFiles: readonly string[]): void {
    const setups = new Set(setupFiles.map(toFileKey));
    const names = listVsnapProjectNames();
    for (const project of vitest.projects) {
        if (names.has(project.name) || !project.config.setupFiles.some((file) => setups.has(toFileKey(file)))) continue;
        throw new Error(
            `The project ${project.name} runs vsnap's visual tests a second time, in a browser that vsnap didn't set up. `
            + "vsnap's projects inherit the config's browser settings, and Vitest adds the config's browser.instances to theirs. "
            + "Move the browser settings out of the config's test block, into the project that needs them, "
            + 'or name the Vite config that vsnap\'s projects need, with vsnap({ viteConfig }).',
        );
    }
}

/**
 * Returns why a run did not run every visual test, so that the checks of
 * every reference image can't run, or undefined if it did run them all.
 */
function findIncompleteness(options: {
    readonly vitest: Vitest;
    readonly testFiles: readonly string[];
    readonly startedFiles: ReadonlySet<string>;
    readonly testModules: readonly TestModule[];
}): string | undefined {
    if (options.vitest.config.testNamePattern !== undefined) return 'a test name pattern (-t) chose the tests';
    const missing = options.testFiles.filter((file) => !options.startedFiles.has(file)).length;
    if (missing > 0) return `${count(missing, 'visual test file')} did not run`;
    if (options.testModules.some((m) => m.errors().length > 0)) return 'a test file failed to load';
    let skipped = 0;
    for (const module of options.testModules) {
        for (const test of module.children.allTests()) {
            if (test.result().state === 'skipped') skipped++;
        }
    }
    if (skipped > 0) return `${count(skipped, 'test')} ${skipped === 1 ? 'was' : 'were'} skipped, by .skip, .only or .todo`;
    return undefined;
}

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
}

/** Returns the references that this run's tests used, by their paths in lower case. */
function listUsedReferences(layout: VisualLayout, testModules: readonly TestModule[]): Map<string, UsedReference> {
    const used = new Map<string, UsedReference>();
    for (const module of testModules) {
        for (const test of module.children.allTests()) {
            const imageName = test.meta().visualImage;
            if (imageName === undefined) continue;
            const file = resolveReferencePath(layout, module.moduleId, imageName);
            const key = resolve(file).toLowerCase();
            const entry = used.get(key) ?? { file, files: new Set<string>(), tests: [] };
            entry.files.add(file);
            entry.tests.push(test.fullName);
            used.set(key, entry);
        }
    }
    return used;
}

/**
 * Returns the summary's lines about references that two or more tests
 * share, and a failure if there are any. Tests share a reference when
 * their image names are the same, such as names that differ only in
 * punctuation, or tests with the same names in two files whose references
 * are in one folder. Names that differ only in case share one too, on
 * every system, since macOS and Windows keep them in one file.
 */
function describeSharedReferences(used: ReadonlyMap<string, UsedReference>): CheckResult {
    const lines: string[] = [];
    for (const { file, files, tests } of used.values()) {
        if (tests.length < 2) continue;
        const caseNote = files.size > 1 ? ' (their names differ only in case, which macOS and Windows keep in one file)' : '';
        lines.push(`    ${toDisplayPath(file)}: ${tests.map((t) => `'${t}'`).join(', ')}${caseNote}`);
    }
    if (lines.length === 0) return { lines: [] };
    const heading = 'These tests share a reference image, so each would overwrite the others. Rename all but one of each group:';
    return { lines: [`  ${heading}`, ...lines], failure: [heading, ...lines].join('\n') };
}

/**
 * Handles the references that no actual image was compared with. In compare
 * mode, it lists them, with a failure. In the modes that write references,
 * it deletes them. It returns the summary's lines about them.
 */
function settleOrphans(options: {
    readonly layout: VisualLayout;
    readonly state: VisualRunState;
    readonly used: ReadonlyMap<string, UsedReference>;
    readonly isUpdate: boolean;
    /** The files whose reference images are the projects', as absolute paths. */
    readonly ownFiles: readonly string[];
}): CheckResult {
    const compared = [...options.state.calibrationReferences, ...[...options.used.values()].flatMap((u) => [...u.files])];
    const orphans = findOrphans({ references: findReferences(options.layout, options.ownFiles).map((r) => r.file), compared });
    if (orphans.length === 0) return { lines: [] };
    const names = orphans.map((file) => `    ${toDisplayPath(file)}`);
    if (!options.isUpdate) {
        const heading = `No test compared with ${countReferences(orphans.length, 'this', 'these')}. Tests that were renamed or deleted left ${orphans.length === 1 ? 'it' : 'them'} behind, and a complete run with Vitest's -u deletes ${orphans.length === 1 ? 'it' : 'them'}:`;
        return { lines: [`  ${heading}`, ...names], failure: [heading, ...names].join('\n') };
    }
    for (const file of orphans) removeReference(file, options.layout.root);
    return { lines: [`  ${countReferences(orphans.length, 'This', 'These')} ${orphans.length === 1 ? 'was' : 'were'} deleted, because no test compared with ${orphans.length === 1 ? 'it' : 'them'}:`, ...names] };
}

/**
 * Decodes every reference image of a root, and every PNG where a test's
 * reference could be, and checks each one's pixels against the hash it
 * carries. Returns the summary's lines about any that don't match, with a
 * failure.
 */
function checkEveryReference(layout: VisualLayout, testFiles: readonly string[]): CheckResult {
    const files = new Map<string, string>();
    for (const { file } of findReferences(layout, testFiles)) files.set(toFileKey(file), file);
    for (const testFile of testFiles) {
        for (const file of findReferenceCandidates(layout, testFile)) files.set(toFileKey(file), file);
    }
    const problems: string[] = [];
    for (const file of files.values()) {
        const problem = checkReference(file);
        if (problem !== undefined) problems.push(`    ${toDisplayPath(file)}: ${problem}`);
    }
    if (problems.length === 0) return { lines: [] };
    const heading = `${problems.length} of ${files.size} references do not match their hashes. Delete them, then rewrite them from their tests with Vitest's -u:`;
    return { lines: [`  ${heading}`, ...problems], failure: [heading, ...problems].join('\n') };
}

/**
 * Throws if vsnap's projects have file lists that vsnap didn't give them. A
 * project that inherits the config it is listed in (`extends: true`) also
 * gets the `include` and `exclude` lists of the config's own `test` block,
 * which Vitest adds to the project's own. They would send unit tests to a
 * browser page, or keep visual tests out of it. So it stops the run with a
 * message that says how to fix it, before any test runs.
 */
function checkForInheritedLists(vitest: Vitest, projectNames: readonly string[], includes: readonly string[]): void {
    const own = new Set(includes);
    const defaults = new Set(configDefaults.exclude);
    for (const project of vitest.projects) {
        if (!projectNames.includes(project.name)) continue;
        const extra = [
            ...project.config.include.filter((pattern) => !own.has(pattern)),
            ...project.config.exclude.filter((pattern) => !defaults.has(pattern)),
        ];
        if (extra.length === 0) continue;
        throw new Error(
            `vsnap's project ${project.name} inherits the config's own include and exclude lists (${extra.join(', ')}). `
            + "Move include and exclude out of the config's test block, into the unit project, "
            + "or name the Vite config that vsnap's projects need, with vsnap({ viteConfig }).",
        );
    }
}

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
