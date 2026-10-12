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
 */

import { appendFileSync } from 'node:fs';
import { configDefaults } from 'vitest/config';
import type { Reporter, TestModule, TestRunEndReason, TestSpecification, Vitest } from 'vitest/node';
import type { VisualTestMeta } from '../protocol.ts';
import type { VisualRunState } from './commands.ts';
import { resolveReferencePath, type VisualLayout } from './layout.ts';
import { toDisplayPath } from './paths.ts';
import { checkReference, findOrphans, findReferenceCandidates, findReferences, removeReference, toFileKey } from './references.ts';

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
}): Reporter {
    const { layout, state, projectNames } = options;
    const testFiles = options.testFiles.map(toFileKey);
    let vitest: Vitest | undefined;
    let started = 0;
    /** The files of this reporter's projects that this run started. */
    let startedFiles = new Set<string>();
    return {
        onInit(v: Vitest) {
            vitest = v;
            checkForInheritedLists(v, projectNames, options.includes);
        },
        onTestRunStart(specifications: readonly TestSpecification[]) {
            started = performance.now();
            startedFiles = new Set(specifications.filter((s) => projectNames.includes(s.project.name)).map((s) => toFileKey(s.moduleId)));
        },
        onTestRunEnd(allModules: readonly TestModule[], _errors: readonly unknown[], reason: TestRunEndReason) {
            const testModules = allModules.filter((m) => projectNames.includes(m.project.name));
            if (testModules.length === 0) return;
            const isUpdate = vitest?.config.snapshotOptions.updateSnapshot === 'all' || process.env.VSNAP_MODE === 'environment';
            const isComplete = reason !== 'interrupted'
                && vitest?.config.testNamePattern === undefined
                && testFiles.every((file) => startedFiles.has(file))
                && testModules.every((m) => m.errors().length === 0 && [...m.children.allTests()].every((t) => t.result().state !== 'skipped'));
            const used = listUsedReferences(layout, testModules);
            const sharedLines = describeSharedReferences(used);
            const orphanLines = [
                ...sharedLines,
                ...(sharedLines.length === 0 && isComplete ? settleOrphans({ layout, state, used, isUpdate }) : []),
                ...(isComplete ? checkEveryReference(layout, options.testFiles) : []),
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
                if (orphanLines.length > 0) console.log(`\n${orphanLines.join('\n')}\n`);
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
            const within = counts.get('within-tolerance') ?? 0;
            if (within > 0) lines.push(`  ${within} matched within the tolerance but not exactly. That is expected only on arm64 processors.`);
            const reduced = images.filter((p) => p.meta.resolution < 1);
            if (reduced.length > 0) {
                const one = reduced.length === 1;
                lines.push(`  ${reduced.length} smooth ${one ? 'image' : 'images'} (artStyle 'smooth') ${one ? 'was' : 'were'} over the size budget, so ${one ? 'it was' : 'they were'} rendered at a lower resolution. Any detail finer than an image pixel is averaged away. Here ${one ? 'is its scale, name and size' : 'are their scales, names and sizes'}:`);
                for (const p of reduced) lines.push(`    1/${1 / p.meta.resolution}  ${p.name}  (${p.meta.width}x${p.meta.height})`);
            }
            const slowest = [...images].sort((a, b) => b.total - a.total).slice(0, 5);
            lines.push(images.length > slowest.length ? '  These tests were the slowest:' : `  ${images.length === 1 ? 'The test' : 'The tests'} took:`);
            for (const p of slowest) lines.push(`    ${p.total.toFixed(1).padStart(7)} ms  ${p.name}  (${p.meta.width}x${p.meta.height})`);
            lines.push(...orphanLines);
            const references = findReferences(layout);
            const bytes = references.reduce((sum, r) => sum + r.bytes, 0);
            const largest = [...references].sort((a, b) => b.bytes - a.bytes).slice(0, 3);
            lines.push(references.length === 1
                ? `  The reference is one file, taking ${formatKilobytes(bytes)}:`
                : `  The references are ${references.length} files, taking ${formatKilobytes(bytes)} in all. ${references.length > largest.length ? 'These are the largest:' : 'They are:'}`);
            for (const r of largest) {
                lines.push(`    ${formatKilobytes(r.bytes).padStart(9)}  ${toDisplayPath(r.file)}`);
            }
            console.log(`\n${lines.join('\n')}\n`);
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
};

/** A reference, and the full names of the tests that used it in this run. */
interface UsedReference {
    readonly file: string;
    readonly tests: string[];
}

/** Returns the references that this run's tests used, by their file keys. */
function listUsedReferences(layout: VisualLayout, testModules: readonly TestModule[]): Map<string, UsedReference> {
    const used = new Map<string, UsedReference>();
    for (const module of testModules) {
        for (const test of module.children.allTests()) {
            const imageName = test.meta().visualImage;
            if (imageName === undefined) continue;
            const file = resolveReferencePath(layout, module.moduleId, imageName);
            const key = toFileKey(file);
            const entry = used.get(key) ?? { file, tests: [] };
            entry.tests.push(test.fullName);
            used.set(key, entry);
        }
    }
    return used;
}

/**
 * Returns the summary's lines about references that two or more tests
 * share, and fails the run if there are any. Tests share a reference when
 * their image names are the same, such as names that differ only in
 * punctuation, or tests with the same names in two files whose references
 * are in one folder.
 */
function describeSharedReferences(used: ReadonlyMap<string, UsedReference>): string[] {
    const lines: string[] = [];
    for (const { file, tests } of used.values()) {
        if (tests.length < 2) continue;
        lines.push(`    ${toDisplayPath(file)}: ${tests.map((t) => `'${t}'`).join(', ')}`);
    }
    if (lines.length === 0) return [];
    process.exitCode = 1;
    return ['  These tests share a reference image, so each would overwrite the others. Rename all but one of each group:', ...lines];
}

/**
 * Handles the references that no actual image was compared with. In compare
 * mode, it lists them and fails the run. In the modes that write
 * references, it deletes them. It returns the summary's lines about them.
 */
function settleOrphans(options: {
    readonly layout: VisualLayout;
    readonly state: VisualRunState;
    readonly used: ReadonlyMap<string, UsedReference>;
    readonly isUpdate: boolean;
}): string[] {
    const compared = [...options.state.calibrationReferences, ...[...options.used.values()].map((u) => u.file)];
    const orphans = findOrphans({ references: findReferences(options.layout).map((r) => r.file), compared });
    if (orphans.length === 0) return [];
    const names = orphans.map((file) => `    ${toDisplayPath(file)}`);
    if (!options.isUpdate) {
        process.exitCode = 1;
        return [
            `  No test compared with ${countReferences(orphans.length, 'this', 'these')}. Tests that were renamed or deleted left ${orphans.length === 1 ? 'it' : 'them'} behind, and a complete run with Vitest's -u deletes ${orphans.length === 1 ? 'it' : 'them'}:`,
            ...names,
        ];
    }
    for (const file of orphans) removeReference(file, options.layout.root);
    return [`  ${countReferences(orphans.length, 'This', 'These')} ${orphans.length === 1 ? 'was' : 'were'} deleted, because no test compared with ${orphans.length === 1 ? 'it' : 'them'}:`, ...names];
}

/**
 * Decodes every reference image of a root, and every PNG where a test's
 * reference could be, and checks each one's pixels against the hash it
 * carries. Fails the run if any doesn't match, and returns the summary's
 * lines about them.
 */
function checkEveryReference(layout: VisualLayout, testFiles: readonly string[]): string[] {
    const files = new Map<string, string>();
    for (const { file } of findReferences(layout)) files.set(toFileKey(file), file);
    for (const testFile of testFiles) {
        for (const file of findReferenceCandidates(layout, testFile)) files.set(toFileKey(file), file);
    }
    const problems: string[] = [];
    for (const file of files.values()) {
        const problem = checkReference(file);
        if (problem !== undefined) problems.push(`    ${toDisplayPath(file)}: ${problem}`);
    }
    if (problems.length === 0) return [];
    process.exitCode = 1;
    return [`  ${problems.length} of ${files.size} references do not match their hashes. Delete them, then rewrite them from their tests with Vitest's -u:`, ...problems];
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
