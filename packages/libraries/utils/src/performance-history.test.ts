import { describe, expect, it } from 'vitest';
import { createPerformanceHistory, METRIC_KINDS, type PerformanceSample } from './performance-history';

const SAMPLE: PerformanceSample = { fps: 60, cpuMs: 3, gpuMs: undefined, reads: 100, methodCalls: 40, methodListRebuilds: 0, rebuildNodeVisits: 0 };

describe('a performance history', () => {
    it('has no values and an empty history before its first sample', () => {
        const history = createPerformanceHistory({ historyLength: 3 });

        expect(history.sampleCount).toBe(0);
        expect(history.fps).toBe(0);
        expect(history.gpuMs).toBeUndefined();
        for (const kind of METRIC_KINDS) {
            for (let i = 0; i < history.historyLength; i++) expect(history.historyAt(kind, i)).toBeNaN();
        }
    });

    it('shows the latest sample, and keeps the recent ones, oldest first', () => {
        const history = createPerformanceHistory({ historyLength: 3 });

        for (let i = 1; i <= 4; i++) history.add({ ...SAMPLE, fps: i * 10 });

        expect(history.sampleCount).toBe(4);
        expect(history.fps).toBe(40);
        expect([0, 1, 2].map((i) => history.historyAt('fps', i))).toEqual([20, 30, 40]);
    });

    it('keeps a GPU time it could not measure as NaN', () => {
        const history = createPerformanceHistory({ historyLength: 2 });

        history.add({ ...SAMPLE, gpuMs: 1.5 });
        history.add(SAMPLE);

        expect(history.gpuMs).toBeUndefined();
        expect(history.historyAt('gpuMs', 0)).toBe(1.5);
        expect(history.historyAt('gpuMs', 1)).toBeNaN();
    });
});
