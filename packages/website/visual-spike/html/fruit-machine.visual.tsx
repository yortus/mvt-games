// Spike: the fruit machine's HTML views, as its entry styles them.
import { refreshView, updateView } from '@mvtjs/html';
import { describe } from 'vitest';
import { createFruitMachineModel } from '../../src/entries/fruit-machine/models';
import { ControlPanelView, loadSymbolArt, TerminalView } from '../../src/entries/fruit-machine/views';
import '../../src/entries/fruit-machine/fruit-machine.css';
import { visualHtmlTest } from '../harness';

const SEED = 12345;

/** The view in the quadrant markup the entry gives it, so the stylesheet's selectors apply. */
function inQuadrant(name: string, view: HTMLElement, width: number, height: number): HTMLElement {
    const root = document.createElement('div');
    root.className = 'fruit-machine';
    root.style.cssText = `position:relative;width:${width}px;height:${height}px;`;
    root.innerHTML = `<section class="quadrant" data-quadrant="${name}" style="width:100%;height:100%"><div class="quadrant-body"></div></section>`;
    root.querySelector('.quadrant-body')!.append(view);
    return root;
}

function advance(model: { update: (ms: number) => void }, view: HTMLElement, totalMs: number): void {
    for (let t = 0; t < totalMs; t += 16) {
        model.update(16);
        updateView(view, 16);
    }
    refreshView(view);
}

describe('fruit machine', () => {
    visualHtmlTest('control panel, ready', async () => {
        const art = await loadSymbolArt();
        const model = createFruitMachineModel({ seed: SEED });
        const view = ControlPanelView({ model, art });
        refreshView(view);
        return inQuadrant('panel', view, 480, 420);
    });
    visualHtmlTest('control panel, mid-spin', async () => {
        const art = await loadSymbolArt();
        const model = createFruitMachineModel({ seed: SEED });
        const view = ControlPanelView({ model, art });
        void model.spin();
        advance(model, view, 600);
        return inQuadrant('panel', view, 480, 420);
    });
    visualHtmlTest('terminal, ready', () => {
        const model = createFruitMachineModel({ seed: SEED });
        const view = TerminalView({ model });
        refreshView(view);
        return inQuadrant('terminal', view, 480, 420);
    });
});
