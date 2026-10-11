/**
 * The reporter that prints the visual run's summary, after Vitest's own
 * summary. It says how many actual images were produced and how they
 * compared. It says how long the tests took, as the median and 95th
 * percentile for each kind of test, and lists the slowest. It also says how
 * much space the references take, and lists the largest. That way, a slow
 * test or a big reference is noticed when it is added. On GitHub, the summary also goes on
 * the job's summary page.
 *
 * After a full run, the reporter also looks for references that no actual
 * image was compared with. A full run is one in which every test ran, and
 * `src/node/cli/vsnap.ts` says whether a run is full. Such references were
 * left by tests that were renamed or deleted. In compare mode, the reporter
 * lists them and fails the run. In the modes that write references, it
 * deletes them. It looks for references under the root of the project being
 * tested, which is the folder that holds the Vitest config.
 *
 * After every run, it also checks that no two tests share a reference
 * image, which would happen if their names differ only in punctuation. If
 * they do, it lists them and fails the run.
 */

import { appendFileSync } from 'node:fs';
import type { InlineConfig, Reporter, TestModule, TestRunEndReason } from 'vitest/node';
import type { VisualTestMeta } from '../protocol';
import type { VisualRunState } from './commands';
import { resolveReferencePath, type VisualLayout } from './layout';
import { toDisplayPath } from './paths';
import { findOrphans, findReferences, removeReference, toFileKey } from './references';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns the reporters for a visual run: Vitest's own, then the visual
 * summary. On GitHub, Vitest's `github-actions` reporter also turns each
 * failure into an annotation on the run.
 */
export function createVisualReporters(options: { readonly layout: VisualLayout; readonly state: VisualRunState }): NonNullable<InlineConfig['reporters']> {
    return ['default', ...(process.env.GITHUB_ACTIONS === 'true' ? ['github-actions' as const] : []), createVisualReporter(options)];
}

/** Creates the reporter that prints the visual run's summary, and handles references that no test used. */
export function createVisualReporter(options: { readonly layout: VisualLayout; readonly state: VisualRunState }): Reporter {
    const { layout, state } = options;
    let started = 0;
    return {
        onTestRunStart() {
            started = performance.now();
        },
        onTestRunEnd(testModules: readonly TestModule[], _errors: readonly unknown[], reason: TestRunEndReason) {
            const used = listUsedReferences(layout, testModules);
            const sharedLines = describeSharedReferences(used);
            const orphanLines = [
                ...sharedLines,
                ...(sharedLines.length === 0 && isFullRun(testModules, reason) ? settleOrphans({ layout, state, used }) : []),
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
            const lines = [`The visual tests produced ${images.length} actual images in ${seconds} s.`];
            for (const kind of ['canvas', 'html'] as const) {
                const times = images.filter((p) => p.meta.kind === kind).map((p) => p.total).sort((a, b) => a - b);
                if (times.length === 0) continue;
                lines.push(`  ${times.length} ${kind === 'canvas' ? 'canvas' : 'HTML'} tests took a median of ${formatPercentile(times, 0.5)} ms, with a 95th percentile of ${formatPercentile(times, 0.95)} ms.`);
            }
            const counts = new Map<string, number>();
            for (const p of images) counts.set(p.meta.outcome, (counts.get(p.meta.outcome) ?? 0) + 1);
            lines.push(`  Compared with their references, ${[...counts].map(([outcome, n]) => `${n} ${OUTCOMES[outcome] ?? outcome}`).join(', ')}.`);
            const within = counts.get('within-tolerance') ?? 0;
            if (within > 0) lines.push(`  ${within} matched within the tolerance but not exactly. That is expected only on arm64 processors.`);
            const reduced = images.filter((p) => p.meta.resolution < 1);
            if (reduced.length > 0) {
                const one = reduced.length === 1;
                lines.push(`  ${reduced.length} smooth ${one ? 'image' : 'images'} (artStyle 'smooth') ${one ? 'was' : 'were'} over the size budget, so ${one ? 'it was' : 'they were'} rendered at a lower resolution. Any detail finer than an image pixel is averaged away. Here ${one ? 'is its scale, name and size' : 'are their scales, names and sizes'}:`);
                for (const p of reduced) lines.push(`    1/${1 / p.meta.resolution}  ${p.name}  (${p.meta.width}x${p.meta.height})`);
            }
            const slowest = [...images].sort((a, b) => b.total - a.total).slice(0, 5);
            lines.push('  These tests were the slowest:');
            for (const p of slowest) lines.push(`    ${p.total.toFixed(1).padStart(7)} ms  ${p.name}  (${p.meta.width}x${p.meta.height})`);
            lines.push(...orphanLines);
            const references = findReferences(layout.root);
            const bytes = references.reduce((sum, r) => sum + r.bytes, 0);
            lines.push(`  The references are ${references.length} files, taking ${formatKilobytes(bytes)} in all. These are the largest:`);
            for (const r of [...references].sort((a, b) => b.bytes - a.bytes).slice(0, 3)) {
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

/**
 * Returns whether every test ran. That is true when the command
 * (`src/node/cli/vsnap.ts`) called the run full because it had no
 * filters, the run was not interrupted, every file loaded, and no test was
 * skipped. Only then is a reference that no actual image was compared with
 * an orphan, rather than a reference whose test did not run this time.
 */
function isFullRun(testModules: readonly TestModule[], reason: TestRunEndReason): boolean {
    if (process.env.VSNAP_FULL_RUN !== '1' || reason === 'interrupted') return false;
    for (const module of testModules) {
        if (module.errors().length > 0) return false;
        for (const test of module.children.allTests()) {
            if (test.result().state === 'skipped') return false;
        }
    }
    return true;
}

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
}): string[] {
    const compared = [...options.state.calibrationReferences, ...[...options.used.values()].map((u) => u.file)];
    const orphans = findOrphans({ references: findReferences(options.layout.root).map((r) => r.file), compared });
    if (orphans.length === 0) return [];
    const names = orphans.map((file) => `    ${toDisplayPath(file)}`);
    if ((process.env.VSNAP_MODE ?? 'compare') === 'compare') {
        process.exitCode = 1;
        return [
            `  No test compared with ${countReferences(orphans.length, 'this', 'these')}. Tests that were renamed or deleted left ${orphans.length === 1 ? 'it' : 'them'} behind, and \`npx vsnap --update\` deletes ${orphans.length === 1 ? 'it' : 'them'}:`,
            ...names,
        ];
    }
    for (const file of orphans) removeReference(file, options.layout.root);
    return [`  ${countReferences(orphans.length, 'This', 'These')} ${orphans.length === 1 ? 'was' : 'were'} deleted, because no test compared with ${orphans.length === 1 ? 'it' : 'them'}:`, ...names];
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
