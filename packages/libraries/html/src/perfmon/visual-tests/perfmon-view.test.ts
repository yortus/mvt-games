import { createPerformanceHistory, type PerformanceHistory, refreshView } from '@mvtjs/utils';
import { htmlTest } from 'v-snap';
import { PerfmonView } from '../perfmon-view';

/** A history of steady samples, with a slow frame now and then, and a burst of churn. */
function steadyHistory(): PerformanceHistory {
    const history = createPerformanceHistory();
    for (let i = 0; i < history.historyLength; i++) {
        const isSlow = i % 15 === 7;
        history.add({
            fps: isSlow ? 41 : 60,
            cpuMs: isSlow ? 21.4 : 3.2 + (i % 4) * 0.3,
            gpuMs: i % 5 === 0 ? undefined : 1.1,
            reads: 21_000 + (i % 6) * 400,
            methodCalls: 950,
            methodListRebuilds: i > 50 ? 2 : 0,
            rebuildNodeVisits: i > 50 ? 340 : 0,
        });
    }
    return history;
}

/** The panel, refreshed once, in a box of a given size, on a dark page, as a game or a pane would hold it. */
function inBox(view: HTMLElement, width: number, height: number): HTMLElement {
    refreshView(view);
    const box = document.createElement('div');
    box.style.cssText = `width:${width}px;height:${height}px;padding:8px;box-sizing:border-box;background:#161b22;`;
    box.append(view);
    return box;
}

const history = steadyHistory();

htmlTest('compact, before any metrics', { viewport: { width: 240, height: 180 } }, () => inBox(PerfmonView({ metrics: () => undefined }), 240, 180));

htmlTest('compact', { viewport: { width: 240, height: 180 } }, () => inBox(PerfmonView({ metrics: () => history }), 240, 180));

htmlTest('compact, with reads not measured', { viewport: { width: 240, height: 180 } }, () => (
    inBox(PerfmonView({ metrics: () => history, unmeasured: ['reads'] }), 240, 180)
));

htmlTest('in a roomy pane', { viewport: { width: 520, height: 260 } }, () => inBox(PerfmonView({ metrics: () => history }), 520, 260));

htmlTest('with its explanation open', { viewport: { width: 520, height: 260 } }, () => {
    const view = PerfmonView({ metrics: () => history });
    view.querySelector('button')!.click();
    return inBox(view, 520, 260);
});

htmlTest('compact, with a title', { viewport: { width: 240, height: 200 } }, () => (
    inBox(PerfmonView({ metrics: () => history, title: 'Performance' }), 240, 200)
));

htmlTest('with a title, and its explanation open with a note', { viewport: { width: 240, height: 200 } }, () => {
    const view = PerfmonView({ metrics: () => history, title: 'Performance', infoNote: 'Drag the title bar to move this panel.' });
    view.querySelector('button')!.click();
    return inBox(view, 240, 200);
});
