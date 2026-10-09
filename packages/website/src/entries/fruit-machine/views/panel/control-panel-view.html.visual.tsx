import { describe } from 'vitest';
import { advanceTime, visualTest } from '#testing';
import '../../fruit-machine.css';
import { createFruitMachineModel } from '../../models';
import { entry } from '../../start';
import { loadSymbolArt } from '../art';
import { ControlPanelView } from './control-panel-view';

const SEED = 12345;

/** The stylesheet's padding round the quadrants, and the gap between them. */
const PADDING = 10;
const GAP = 10;

/**
 * Returns the panel inside the quadrant that its entry gives it, so the
 * stylesheet's selectors apply. The machine's grid is two quadrants by two.
 * Here a lone quadrant spans the grid, in a machine only one quadrant in
 * size. So the quadrant is as big as it is at the entry's play size.
 */
function placeInQuadrant(view: Element): HTMLElement {
    const width = (entry.screenWidth - 2 * PADDING - GAP) / 2 + 2 * PADDING;
    const height = (entry.screenHeight - 2 * PADDING - GAP) / 2 + 2 * PADDING;
    const root = document.createElement('div');
    root.className = 'fruit-machine';
    root.style.cssText = `width:${width}px;height:${height}px;`;
    root.innerHTML = '<section class="quadrant" data-quadrant="panel" style="grid-area:1 / 1 / -1 / -1"><div class="quadrant-body"></div></section>';
    root.querySelector('.quadrant-body')?.append(view);
    return root;
}

describe('ControlPanelView', () => {
    visualTest('ready to spin', async () => {
        const art = await loadSymbolArt();
        const model = createFruitMachineModel({ seed: SEED });
        return placeInQuadrant(ControlPanelView({ model, art }));
    });

    visualTest('mid-spin', async () => {
        const art = await loadSymbolArt();
        const model = createFruitMachineModel({ seed: SEED });
        const view = ControlPanelView({ model, art });
        void model.spin();
        await advanceTime({ models: [model], views: [view], totalMs: 600 });
        return placeInQuadrant(view);
    });
});
