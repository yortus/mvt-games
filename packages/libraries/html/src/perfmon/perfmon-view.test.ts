// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createPerformanceHistory, type MetricKind, refreshView } from '@mvtjs/utils';
import { PerfmonView } from './perfmon-view';

describe('PerfmonView', () => {
    it('shows n/a for the metrics it is told are not measured, as they change', () => {
        const history = createPerformanceHistory();
        history.add({ fps: 60, cpuMs: 3, gpuMs: 1, reads: 120, methodCalls: 40, methodListRebuilds: 0, rebuildNodeVisits: 0 });
        let unmeasured: readonly MetricKind[] = [];
        const view = PerfmonView({ metrics: () => history, unmeasured: () => unmeasured });

        refreshView(view);
        expect(valueOf(view, 'Reads')).toBe('120');

        // The metrics are the same, but which of them are measured has changed
        unmeasured = ['reads'];
        refreshView(view);
        expect(valueOf(view, 'Reads')).toBe('n/a');
        expect(valueOf(view, 'FPS')).toBe('60');

        unmeasured = [];
        refreshView(view);
        expect(valueOf(view, 'Reads')).toBe('120');
    });

    it('takes a fixed list of metrics that are not measured', () => {
        const history = createPerformanceHistory();
        history.add({ fps: 60, cpuMs: 3, gpuMs: 1, reads: 120, methodCalls: 40, methodListRebuilds: 0, rebuildNodeVisits: 0 });
        const view = PerfmonView({ metrics: () => history, unmeasured: ['gpuMs'] });
        refreshView(view);
        expect(valueOf(view, 'GPU')).toBe('n/a');
        expect(valueOf(view, 'CPU')).toBe('3.0 ms');
    });
});

describe('PerfmonView\'s frame budget', () => {
    // Every frame takes the whole of a 60 FPS budget, so the CPU graph's tallest bar is one frame at 60 FPS
    const FULL_FRAME_AT_60_MS = 1000 / 60;

    it('marks a frame at the display\'s rate, from the highest frame rate in the history', () => {
        const view = PerfmonView({ metrics: () => historyAt(119.6) });
        refreshView(view);
        // At 120 FPS, a frame has half the time, so its line is half way up the graph
        expect(budgetLineY(view)).toBeCloseTo(GRAPH_HEIGHT / 2);
    });

    it('marks a frame at 60 FPS while the history runs at 60', () => {
        const view = PerfmonView({ metrics: () => historyAt(59.8) });
        refreshView(view);
        expect(budgetLineY(view)).toBeCloseTo(0);
    });

    it('marks the budget it is given, whatever the display', () => {
        let budgetMs = 1000 / 30;
        const view = PerfmonView({ metrics: () => historyAt(119.6), frameBudgetMs: () => budgetMs });
        refreshView(view);
        // A 30 FPS budget is taller than any bar, so the graph is scaled to it, and its line is at the top
        expect(budgetLineY(view)).toBeCloseTo(0);
        budgetMs = FULL_FRAME_AT_60_MS / 2;
        refreshView(view);
        expect(budgetLineY(view)).toBeCloseTo(GRAPH_HEIGHT / 2);
    });

    /** A history of frames at `fps`, each taking a 60 FPS frame's whole budget on the CPU. */
    function historyAt(fps: number): ReturnType<typeof createPerformanceHistory> {
        const history = createPerformanceHistory();
        for (let i = 0; i < history.historyLength; i++) {
            history.add({ fps, cpuMs: FULL_FRAME_AT_60_MS, gpuMs: undefined, reads: 0, methodCalls: 0, methodListRebuilds: 0, rebuildNodeVisits: 0 });
        }
        return history;
    }
});

/** The graph's height, in its own units, as the view draws it. */
const GRAPH_HEIGHT = 12;

/** How far down the CPU graph its budget line is, in the graph's own units. */
function budgetLineY(view: HTMLElement): number {
    const graph = view.querySelectorAll('.mvt-perfmon-graph')[1];
    const d = graph.querySelector('.mvt-perfmon-budget')!.getAttribute('d') ?? '';
    return Number(/^M0 (\S+)H/.exec(d)?.[1]);
}

/** The value shown beside the label `label`. */
function valueOf(view: HTMLElement, label: string): string | undefined {
    const labels = Array.from(view.querySelectorAll('.mvt-perfmon-label'));
    const found = labels.find((e) => e.textContent === label);
    return found?.nextElementSibling?.textContent ?? undefined;
}
