import { describe, expect, it } from 'vitest';
import { estimateFrameBudgetMs } from './estimate-frame-budget-ms';
import { createPerformanceHistory, type PerformanceHistory } from './performance-history';

describe('estimateFrameBudgetMs', () => {
    it('allows a frame at 60 FPS when there is nothing to go by', () => {
        expect(estimateFrameBudgetMs(undefined)).toBeCloseTo(1000 / 60, 9);
        expect(estimateFrameBudgetMs(createPerformanceHistory())).toBeCloseTo(1000 / 60, 9);
    });

    it('rounds the rate to the nearest common refresh rate', () => {
        expect(estimateFrameBudgetMs(historyAt([59.4]))).toBeCloseTo(1000 / 60, 9);
        expect(estimateFrameBudgetMs(historyAt([119.6]))).toBeCloseTo(1000 / 120, 9);
    });

    it('goes by the highest rate, so it remembers the display after a slowdown', () => {
        expect(estimateFrameBudgetMs(historyAt([60, 60, 12, 9]))).toBeCloseTo(1000 / 60, 9);
    });

    it('never allows more than a frame at the slowest refresh rate, however slow the frames are', () => {
        expect(estimateFrameBudgetMs(historyAt([5]))).toBeCloseTo(1000 / 30, 9);
    });
});

/** A history with the given frame rates in it. */
function historyAt(rates: readonly number[]): PerformanceHistory {
    const history = createPerformanceHistory();
    for (const fps of rates) {
        history.add({ fps, missedShare: 0, cpuMs: 1, gpuMs: undefined, reads: 0, methodCalls: 0, methodListRebuilds: 0, rebuildNodeVisits: 0 });
    }
    return history;
}
