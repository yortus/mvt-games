/**
 * The visual run's summary, printed after Vitest's own: how many pictures,
 * how they compared, how long they took (median and 95th percentile per
 * kind), and the slowest. So a slow test is noticed when it is added.
 */

import type { Reporter, TestModule } from 'vitest/node';
import type { VisualTestMeta } from '../../src/testing';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createVisualReporter(): Reporter {
    let started = 0;
    return {
        onTestRunStart() {
            started = performance.now();
        },
        onTestRunEnd(testModules: readonly TestModule[]) {
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
            if (pictures.length === 0) return;
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
            const slowest = [...pictures].sort((a, b) => b.total - a.total).slice(0, 5);
            lines.push('  Slowest:');
            for (const p of slowest) lines.push(`    ${p.total.toFixed(1).padStart(7)} ms  ${p.name}  (${p.meta.width}x${p.meta.height})`);
            console.log(`\n${lines.join('\n')}\n`);
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

function percentile(sorted: readonly number[], fraction: number): string {
    return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))].toFixed(1);
}
