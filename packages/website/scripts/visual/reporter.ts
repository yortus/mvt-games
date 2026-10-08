/**
 * The visual run's summary, printed after Vitest's own: how many pictures,
 * how they compared, how long they took (median and 95th percentile per
 * kind), the slowest, and how much the references take, with the largest.
 * So a slow test, or a big picture, is noticed when it is added. On GitHub
 * it also goes on the job's summary page.
 *
 * After a full run (`scripts/visual/run.ts` says which), it also looks for
 * references no picture was compared with, left by tests renamed or
 * deleted: it lists them and fails the run, or, updating, deletes them.
 */

import { appendFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Reporter, TestModule, TestRunEndReason } from 'vitest/node';
import type { VisualTestMeta } from '../../src/testing';
import { comparedCalibrationReferences } from './commands';
import { findReferences, orphansOf, referenceDirOf, removeReference } from './references';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createVisualReporter(): Reporter {
    let started = 0;
    return {
        onTestRunStart() {
            started = performance.now();
        },
        onTestRunEnd(testModules: readonly TestModule[], _errors: readonly unknown[], reason: TestRunEndReason) {
            const orphanLines = isFullRun(testModules, reason) ? settleOrphans(testModules) : [];
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
            const lines = [`Visual: ${pictures.length} pictures in ${seconds} s`];
            for (const kind of ['pixi', 'html'] as const) {
                const times = pictures.filter((p) => p.meta.kind === kind).map((p) => p.total).sort((a, b) => a - b);
                if (times.length === 0) continue;
                lines.push(`  ${kind === 'pixi' ? 'WebGL' : 'HTML'}: ${times.length}, median ${percentile(times, 0.5)} ms, 95th percentile ${percentile(times, 0.95)} ms`);
            }
            const counts = new Map<string, number>();
            for (const p of pictures) counts.set(p.meta.outcome, (counts.get(p.meta.outcome) ?? 0) + 1);
            lines.push(`  ${[...counts].map(([outcome, n]) => `${n} ${OUTCOMES[outcome] ?? outcome}`).join(', ')}`);
            const within = counts.get('within-tolerance') ?? 0;
            if (within > 0) lines.push(`  ${within} matched within tolerance, not exactly: expected only on arm64`);
            const reduced = pictures.filter((p) => p.meta.resolution < 1);
            if (reduced.length > 0) {
                lines.push(`  ${reduced.length} smooth (artStyle 'smooth'), over the size budget, drawn at a lower resolution (detail finer than a picture pixel is averaged away):`);
                for (const p of reduced) lines.push(`    1/${1 / p.meta.resolution}  ${p.name}  (${p.meta.width}x${p.meta.height})`);
            }
            const slowest = [...pictures].sort((a, b) => b.total - a.total).slice(0, 5);
            lines.push('  Slowest:');
            for (const p of slowest) lines.push(`    ${p.total.toFixed(1).padStart(7)} ms  ${p.name}  (${p.meta.width}x${p.meta.height})`);
            lines.push(...orphanLines);
            const references = findReferences(join(WEBSITE, 'src'));
            const bytes = references.reduce((sum, r) => sum + r.bytes, 0);
            lines.push(`  References: ${references.length} files, ${kilobytes(bytes)}. Largest:`);
            for (const r of [...references].sort((a, b) => b.bytes - a.bytes).slice(0, 3)) {
                lines.push(`    ${kilobytes(r.bytes).padStart(9)}  ${relative(WEBSITE, r.file).replaceAll('\\', '/')}`);
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

const WEBSITE = resolve(import.meta.dirname, '..', '..');

/**
 * Whether every test ran: a run the runner calls full (no filters), not
 * interrupted, with every file loaded and no test skipped. Only then is a
 * reference no picture used an orphan, not one whose test sat this run out.
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
 * Lists the references no picture was compared with, and fails the run; or,
 * updating, deletes them. Returns the summary's lines about them.
 */
function settleOrphans(testModules: readonly TestModule[]): string[] {
    const compared = new Set(comparedCalibrationReferences());
    for (const module of testModules) {
        for (const test of module.children.allTests()) {
            const picture = test.meta().visualPicture;
            if (picture !== undefined) compared.add(join(referenceDirOf(module.moduleId), `${picture}.png`));
        }
    }
    const orphans = orphansOf({ references: findReferences(join(WEBSITE, 'src')).map((r) => r.file), compared });
    if (orphans.length === 0) return [];
    const names = orphans.map((file) => `    ${relative(WEBSITE, file).replaceAll('\\', '/')}`);
    if ((process.env.VISUAL_MODE ?? 'compare') === 'compare') {
        process.exitCode = 1;
        return [
            `  ${orphans.length} references no test compared with, left by tests renamed or deleted (\`npm run test:visual:update\` deletes them):`,
            ...names,
        ];
    }
    for (const file of orphans) removeReference(file);
    return [`  Deleted ${orphans.length} references no test compared with:`, ...names];
}

function kilobytes(bytes: number): string {
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function percentile(sorted: readonly number[], fraction: number): string {
    return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))].toFixed(1);
}
