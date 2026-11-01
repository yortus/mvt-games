import { Container, Graphics } from 'pixi.js';
import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import type { TutorialDemoKind } from '../../models';
import { TutorialPointerView } from '../tutorial-pointer-view';
import { CELL_SIZE, GRID_X, GRID_Y, PAPER_COLOR } from '../view-constants';

// Drawn large, over the grid's top left corner, so the arrow's shape can be seen
const SIZE = { width: 300, height: 300, pixelArt: false };
const ZOOM = 2.5;

// The show comes in for 600 ms, then a tap touches down for 150 ms
canvasTest('coming in to tap a cell', SIZE, () => pose('select', [10], [], 540));
canvasTest('touching down on a cell, with a ripple', SIZE, () => pose('select', [10], [], 680));
canvasTest('partway through a drag, with a trail', SIZE, () => pose('link', [9, 11], [], 1300));

/** The pointer showing `demo`, `ms` into its show. */
async function pose(demo: TutorialDemoKind, cells: readonly number[], digits: readonly number[], ms: number): Promise<Container> {
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, SIZE.width, SIZE.height).fill(PAPER_COLOR));
    const zoomed = new Container();
    zoomed.scale.set(ZOOM);
    zoomed.position.set(-(GRID_X + CELL_SIZE * 0.4) * ZOOM, -(GRID_Y + CELL_SIZE * 0.6) * ZOOM);
    zoomed.addChild(TutorialPointerView({ demo: () => demo, demoCells: () => cells, demoDigits: () => digits, demosShown: () => 1 }));
    view.addChild(zoomed);
    await advanceTime(ms, view);
    return view;
}
