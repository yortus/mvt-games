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

import { appendFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { configDefaults } from 'vitest/config';
import type { Reporter, TestModule, TestRunEndReason, Vitest } from 'vitest/node';
import { toImageName } from '../image-name.ts';
import type { VisualTestMeta } from '../protocol.ts';
import type { VisualRunState } from './commands.ts';
import { resolveReferencePath, type VisualLayout } from './layout.ts';
import { OUT_DIR, toDisplayPath, toOutputBase } from './paths.ts';
import { checkReferences, findCandidatesOfFiles, findOrphans, findReferences, findReferencesOfFiles, removeReference, toFileKey } from './references.ts';
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
    /** The files whose reference images are this reporter's: its test files, and those that can't run yet, as absolute paths. */
    const ownFiles = [...options.testFiles, ...options.problems.map((p) => resolve(layout.root, p.file))];
    let vitest: Vitest | undefined;
    /** When the run's first visual test file started, for the summary's time. */
    let started: number | undefined;
    return {
        onInit(v: Vitest) {
            vitest = v;
            checkForInheritedLists(v, projectNames, options.includes);
            checkForInheritedSetupFiles(v, projectNames, options.setupFiles);
            checkForInheritedInstances(v, options.setupFiles);
        },
        onTestRunStart() {
            started = undefined;
            state.cdpSessions.clear();
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
            const outcome = reason === 'interrupted' ? undefined : runChecks({ layout, state, vitest, testFiles: options.testFiles, ownFiles, testModules });
            clearPassedOutputs(layout, testModules);
            failures.push(...(outcome?.failures ?? []));
            const lines = describeRun({ projectNames, testModules, outcome, started, reason, ownFiles, layout });
            if (lines.length > 0) print(vitest, `\n${lines.join('\n')}\n`);
            const summary = process.env.GITHUB_STEP_SUMMARY;
            if (summary !== undefined && summary !== '' && lines.length > 0) appendFileSync(summary, `\`\`\`\n${lines.join('\n')}\n\`\`\`\n`);
            if (failures.length > 0) failRun(vitest, failures);
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The words for each outcome in the summary, for one image and for several. */
const OUTCOMES: Readonly<Record<string, readonly [string, string]>> = {
    'same': ['identical', 'identical'],
    'within-tolerance': ['within tolerance', 'within tolerance'],
    'differs': ['differs', 'differ'],
    'new': ['new', 'new'],
    'size': ['changed size', 'changed size'],
    'updated': ['updated', 'updated'],
    'added': ['added', 'added'],
};

/**
 * Returns the summary's lines: the actual images and their times, what the
 * checks found, and the references. A run that didn't run every visual test
 * file, such as a rerun in watch mode, gets a short summary, without the
 * slowest tests and the largest references.
 */
function describeRun(options: {
    readonly projectNames: readonly string[];
    readonly testModules: readonly TestModule[];
    readonly outcome: CheckOutcome | undefined;
    readonly started: number | undefined;
    readonly reason: TestRunEndReason;
    readonly ownFiles: readonly string[];
    readonly layout: VisualLayout;
}): string[] {
    const { outcome } = options;
    const checkLines = outcome?.lines ?? ['  The reference images were not checked, and no unused ones were looked for, because the run was interrupted.'];
    const images: { name: string; meta: VisualTestMeta; total: number }[] = [];
    for (const module of options.testModules) {
        for (const test of module.children.allTests()) {
            const meta = test.meta().vsnap?.result;
            if (meta === undefined) continue;
            let total = 0;
            for (const ms of Object.values(meta.ms)) total += ms;
            images.push({ name: test.fullName, meta, total });
        }
    }
    if (images.length === 0) return [...checkLines];
    const seconds = (((performance.now() - (options.started ?? performance.now()))) / 1000).toFixed(1);
    const lines = [`The visual tests (${options.projectNames.join(', ')}) produced ${count(images.length, 'actual image')} in ${seconds} s.`];
    for (const pageKind of ['canvas', 'html'] as const) {
        const times = images.filter((p) => p.meta.pageKind === pageKind).map((p) => p.total).sort((a, b) => a - b);
        if (times.length === 0) continue;
        const tests = count(times.length, `${pageKind === 'canvas' ? 'canvas' : 'HTML'} test`);
        lines.push(times.length === 1
            ? `  ${tests} took ${formatPercentile(times, 0.5)} ms.`
            : `  ${tests} took a median of ${formatPercentile(times, 0.5)} ms, with a 95th percentile of ${formatPercentile(times, 0.95)} ms.`);
    }
    const counts = new Map<string, number>();
    for (const p of images) counts.set(p.meta.outcome, (counts.get(p.meta.outcome) ?? 0) + 1);
    const outcomes = [...counts].map(([name, n]) => `${n} ${OUTCOMES[name]?.[n === 1 ? 0 : 1] ?? name}`);
    lines.push(`  Compared with ${images.length === 1 ? 'its reference' : 'their references'}, ${outcomes.join(', ')}.`);
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
    if (outcome?.isComplete !== true) return [...lines, ...checkLines];
    const slowest = [...images].sort((a, b) => b.total - a.total).slice(0, 5);
    lines.push(images.length > slowest.length ? '  These tests were the slowest:' : `  ${images.length === 1 ? 'The test' : 'The tests'} took:`);
    for (const p of slowest) lines.push(`    ${p.total.toFixed(1).padStart(7)} ms  ${p.name}  (${p.meta.width}x${p.meta.height})`);
    lines.push(...checkLines);
    const references = outcome.references;
    const bytes = references.reduce((sum, r) => sum + r.bytes, 0);
    const largest = [...references].sort((a, b) => b.bytes - a.bytes).slice(0, 3);
    if (references.length === 1) lines.push(`  The reference is one file, taking ${formatKilobytes(bytes)}:`);
    else if (references.length > 1) lines.push(`  The references are ${references.length} files, taking ${formatKilobytes(bytes)} in all. ${references.length > largest.length ? 'These are the largest:' : 'They are:'}`);
    for (const r of largest) lines.push(`    ${formatKilobytes(r.bytes).padStart(9)}  ${toDisplayPath(r.file)}`);
    return lines;
}

/**
 * Fails the run over vsnap's own checks, as Vitest's coverage thresholds
 * fail it: it prints what failed, under a heading of its own, and sets the
 * exit code. They aren't test failures, nor errors that Vitest caught, so
 * they don't go through either. In GitHub Actions, each also becomes an
 * error annotation.
 */
function failRun(vitest: Vitest | undefined, failures: readonly string[]): void {
    const blocks = failures.map((failure) => failure.split('\n').map((line) => `  ${line}`).join('\n'));
    print(vitest, `\n FAIL  vsnap's checks of the reference images failed, so the run fails:\n\n${blocks.join('\n\n')}\n`);
    if (process.env.GITHUB_ACTIONS === 'true') {
        for (const failure of failures) console.error(`::error title=vsnap::${failure.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
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
    /** The summary's lines about the checks. */
    readonly lines: readonly string[];
    /** The checks that failed, each a heading and its lines. */
    readonly failures: readonly string[];
    /** The references that the checks covered, with their sizes, found once for the summary too. */
    readonly references: readonly { readonly file: string; readonly bytes: number }[];
    /** Whether every visual test file ran and loaded, so that the checks covered every reference, those of deleted test files too. */
    readonly isComplete: boolean;
}

/** The lines that a check adds to the summary, and its failure, if it failed. */
interface CheckResult {
    readonly lines: readonly string[];
    readonly failure?: string;
}

/**
 * Runs the checks of the references, once every test file of the run has
 * ended, and returns what they found.
 *
 * - Two tests that share a reference fail the run.
 * - References that no test uses are listed, and fail the run, or are
 *   deleted with `-u`. A test that didn't run, because it was skipped or a
 *   filter left it out, still uses its reference, by its name.
 * - Every reference's pixels are checked against the hash it carries.
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
}): CheckOutcome {
    const { layout, state, vitest } = options;
    const isUpdate = vitest.config.snapshotOptions.updateSnapshot === 'all' || process.env.VSNAP_MODE === 'environment';
    // A file that failed to load has no tests to say which references it uses.
    const loaded = options.testModules.filter((m) => m.errors().length === 0);
    const loadedKeys = new Set(loaded.map((m) => toFileKey(m.moduleId)));
    const ran = new Set(options.testModules.map((m) => toFileKey(m.moduleId)));
    const notRun = options.testFiles.filter((file) => !ran.has(toFileKey(file))).length;
    const isComplete = notRun === 0 && loaded.length === options.testModules.length;
    const others = options.ownFiles.filter((file) => !loadedKeys.has(toFileKey(file)));
    const covered = loaded.map((m) => m.moduleId);
    const references = isComplete ? findReferences(layout, options.ownFiles) : findReferencesOfFiles(layout, covered, others);
    const candidates = findCandidatesOfFiles(layout, isComplete ? options.ownFiles : covered, isComplete ? [] : others);
    const used = listUsedReferences(layout, options.testModules);
    const named = listNamedReferences(layout, loaded);
    const results = [
        describeSharedReferences(used),
        settleOrphans({ layout, state, references: references.map((r) => r.file), used, named, isUpdate, isComplete }),
        checkEveryReference([...references.map((r) => r.file), ...candidates]),
    ];
    const lines: string[] = [];
    const failures: string[] = [];
    for (const result of results) {
        if (result.failure !== undefined) failures.push(result.failure);
        else lines.push(...result.lines);
    }
    for (const module of options.testModules) {
        if (!loadedKeys.has(toFileKey(module.moduleId))) lines.push(`  ${toDisplayPath(module.moduleId)} failed to load, so its references were not checked.`);
    }
    if (!isComplete) {
        const files = loaded.length === 1 ? 'the visual test file' : `the ${loaded.length} visual test files`;
        lines.push(`  Only the references of ${files} that ran were checked. A run of every visual test file checks them all, and also finds the references of deleted test files.`);
    }
    return { lines, failures, references, isComplete };
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
            const imageName = test.meta().vsnap?.image;
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
 * Handles the references that no test used. In compare mode, it lists them,
 * with a failure. In the modes that write references, it deletes them. It
 * returns the summary's lines about them.
 */
function settleOrphans(options: {
    readonly layout: VisualLayout;
    readonly state: VisualRunState;
    /** The references that the checks cover, as absolute paths. */
    readonly references: readonly string[];
    readonly used: ReadonlyMap<string, UsedReference>;
    /** The references of the tests that recorded no image, as file keys. */
    readonly named: ReadonlySet<string>;
    readonly isUpdate: boolean;
    /** Whether every visual test file ran, for the message. */
    readonly isComplete: boolean;
}): CheckResult {
    const compared = [...options.state.calibrationReferences, ...[...options.used.values()].flatMap((u) => [...u.files])];
    const orphans = findOrphans({ references: options.references, compared }).filter((file) => !options.named.has(toFileKey(file)));
    if (orphans.length === 0) return { lines: [] };
    const names = orphans.map((file) => `    ${toDisplayPath(file)}`);
    if (!options.isUpdate) {
        const it = orphans.length === 1 ? 'it' : 'them';
        const heading = `No test uses ${countReferences(orphans.length, 'this', 'these')}. Tests that were renamed or deleted left ${it} behind, and a run with Vitest's -u deletes ${it}:`;
        return { lines: [`  ${heading}`, ...names], failure: [heading, ...names].join('\n') };
    }
    for (const file of orphans) removeReference(file, options.layout.root);
    return { lines: [`  ${countReferences(orphans.length, 'This', 'These')} ${orphans.length === 1 ? 'was' : 'were'} deleted, because no test uses ${orphans.length === 1 ? 'it' : 'them'}:`, ...names] };
}

/**
 * Checks each reference's pixels against the hash it carries, and each PNG
 * where a test's reference could be, which finds one that lost its hash.
 * A reference that passed before, unchanged since, isn't decoded again.
 * Returns the summary's lines about any that fail, with a failure.
 */
function checkEveryReference(files: readonly string[]): CheckResult {
    const unique = new Map<string, string>();
    // A reference that the run deleted, as unused, is gone.
    for (const file of files) if (existsSync(file)) unique.set(toFileKey(file), file);
    const problems: string[] = [];
    for (const [file, problem] of checkReferences([...unique.values()], join(OUT_DIR, 'reference-checks.json'))) {
        if (problem !== undefined) problems.push(`    ${toDisplayPath(file)}: ${problem}`);
    }
    if (problems.length === 0) return { lines: [] };
    const heading = `${problems.length} of ${unique.size} references do not match their hashes. Delete them, then rewrite them from their tests with Vitest's -u:`;
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
