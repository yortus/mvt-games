/**
 * The reporter that prints the visual run's summary, after Vitest's own
 * summary. It says how many pictures were drawn and how they compared. It
 * says how long they took, as the median and 95th percentile for each kind
 * of picture, and lists the slowest. It also says how much space the
 * references take, and lists the largest. That way, a slow test or a big
 * picture is noticed when it is added. On GitHub, the summary also goes on
 * the job's summary page.
 *
 * After a full run, the reporter also looks for references that no picture
 * was compared with. A full run is one in which every test ran, and
 * `scripts/run.ts` says whether a run is full. Such references were
 * left by tests that were renamed or deleted. In compare mode, the reporter
 * lists them and fails the run. In the modes that write references, it
 * deletes them. It looks for references under the root of the project being
 * tested, which is the folder that holds the Vitest config.
 */

import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { InlineConfig, Reporter, TestModule, TestRunEndReason, Vitest } from 'vitest/node';
import type { VisualTestMeta } from '../protocol';
import { listComparedCalibrationReferences } from './commands';
import { toDisplayPath } from './paths';
import { findReferences, findOrphans, findReferenceDir, removeReference } from './references';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns the reporters for a visual run: Vitest's own, then the visual
 * summary. On GitHub, Vitest's `github-actions` reporter also turns each
 * failure into an annotation on the run.
 */
export function createVisualReporters(): NonNullable<InlineConfig['reporters']> {
    return ['default', ...(process.env.GITHUB_ACTIONS === 'true' ? ['github-actions' as const] : []), createVisualReporter()];
}

/** Creates the reporter that prints the visual run's summary, and handles references that no test used. */
export function createVisualReporter(): Reporter {
    let started = 0;
    let root = process.cwd();
    return {
        onInit(vitest: Vitest) {
            root = vitest.config.root;
        },
        onTestRunStart() {
            started = performance.now();
        },
        onTestRunEnd(testModules: readonly TestModule[], _errors: readonly unknown[], reason: TestRunEndReason) {
            const orphanLines = isFullRun(testModules, reason) ? settleOrphans(testModules, root) : [];
            const pictures: { name: string; meta: VisualTestMeta; total: number }[] = [];
            for (const module of testModules) {
                for (const test of module.children.allTests()) {
                    const meta = test.meta().visual;
                    if (meta === undefined) continue;
                    let total = 0;
                    for (const ms of Object.values(meta.ms)) total += ms;
                    pictures.push({ name: test.fullName, meta, total });
                }
            }
            if (pictures.length === 0) {
                if (orphanLines.length > 0) console.log(`\n${orphanLines.join('\n')}\n`);
                return;
            }
            const seconds = ((performance.now() - started) / 1000).toFixed(1);
            const lines = [`The visual tests drew ${pictures.length} pictures in ${seconds} s.`];
            for (const kind of ['pixi', 'html'] as const) {
                const times = pictures.filter((p) => p.meta.kind === kind).map((p) => p.total).sort((a, b) => a - b);
                if (times.length === 0) continue;
                lines.push(`  ${times.length} ${kind === 'pixi' ? 'WebGL' : 'HTML'} pictures took a median of ${formatPercentile(times, 0.5)} ms, with a 95th percentile of ${formatPercentile(times, 0.95)} ms.`);
            }
            const counts = new Map<string, number>();
            for (const p of pictures) counts.set(p.meta.outcome, (counts.get(p.meta.outcome) ?? 0) + 1);
            lines.push(`  Compared with their references, ${[...counts].map(([outcome, n]) => `${n} ${OUTCOMES[outcome] ?? outcome}`).join(', ')}.`);
            const within = counts.get('within-tolerance') ?? 0;
            if (within > 0) lines.push(`  ${within} matched within the tolerance but not exactly. That is expected only on arm64 processors.`);
            const reduced = pictures.filter((p) => p.meta.resolution < 1);
            if (reduced.length > 0) {
                lines.push(`  ${reduced.length} smooth pictures (artStyle 'smooth') were over the size budget, so they were drawn at a lower resolution. Any detail finer than a picture pixel is averaged away. Here are their scales, names and sizes:`);
                for (const p of reduced) lines.push(`    1/${1 / p.meta.resolution}  ${p.name}  (${p.meta.width}x${p.meta.height})`);
            }
            const slowest = [...pictures].sort((a, b) => b.total - a.total).slice(0, 5);
            lines.push('  These pictures were the slowest:');
            for (const p of slowest) lines.push(`    ${p.total.toFixed(1).padStart(7)} ms  ${p.name}  (${p.meta.width}x${p.meta.height})`);
            lines.push(...orphanLines);
            const references = findReferences(root);
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
 * Returns whether every test ran. That is true when `scripts/run.ts` called the run
 * full (it had no filters), the run was not interrupted, every file loaded,
 * and no test was skipped. Only then is a reference that no picture used an
 * orphan, rather than a reference whose test did not run this time.
 */
function isFullRun(testModules: readonly TestModule[], reason: TestRunEndReason): boolean {
    if (process.env.VISUAL_FULL_RUN !== '1' || reason === 'interrupted') return false;
    for (const module of testModules) {
        if (module.errors().length > 0) return false;
        for (const test of module.children.allTests()) {
            if (test.result().state === 'skipped') return false;
        }
    }
    return true;
}

/**
 * Handles the references that no picture was compared with. In compare
 * mode, it lists them and fails the run. In the modes that write
 * references, it deletes them. It returns the summary's lines about them.
 */
function settleOrphans(testModules: readonly TestModule[], root: string): string[] {
    const compared = new Set(listComparedCalibrationReferences());
    for (const module of testModules) {
        for (const test of module.children.allTests()) {
            const picture = test.meta().visualPicture;
            if (picture !== undefined) compared.add(join(findReferenceDir(module.moduleId), `${picture}.png`));
        }
    }
    const orphans = findOrphans({ references: findReferences(root).map((r) => r.file), compared });
    if (orphans.length === 0) return [];
    const names = orphans.map((file) => `    ${toDisplayPath(file)}`);
    if ((process.env.VISUAL_MODE ?? 'compare') === 'compare') {
        process.exitCode = 1;
        return [
            `  No test compared with these ${orphans.length} references. Tests that were renamed or deleted left them behind, and \`npm run test:visual:update\` deletes them:`,
            ...names,
        ];
    }
    for (const file of orphans) removeReference(file);
    return [`  These ${orphans.length} references were deleted, because no test compared with them:`, ...names];
}

function formatKilobytes(bytes: number): string {
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatPercentile(sorted: readonly number[], fraction: number): string {
    return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))].toFixed(1);
}
