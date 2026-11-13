import { Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { BoardShapes } from './board-shapes';
import { LEAD_COLOR, PICKED_COLOR, TARGET_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface OutlinesViewBindings {
    /** The window's shapes, read once. */
    shapes: BoardShapes;
    /** The tile picked up by a tap, the tile being dragged, and the tile a drag would swap with, each -1 for none. */
    pickedTile: () => number;
    draggedTile: () => number;
    targetTile: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The outline of a piece picked up by a tap, the tile a drag would swap with, and the empty tile a dragged piece left. */
export function OutlinesView(bindings: OutlinesViewBindings): Graphics {
    const { insets } = bindings.shapes;
    const view = new Graphics();
    let drawnPicked = -2;
    let drawnDragged = -2;
    let drawnTarget = -2;
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const picked = bindings.pickedTile();
        const dragged = bindings.draggedTile();
        const target = bindings.targetTile();
        if (picked === drawnPicked && dragged === drawnDragged && target === drawnTarget) return;
        drawnPicked = picked;
        drawnDragged = dragged;
        drawnTarget = target;
        view.clear();
        if (dragged >= 0) view.poly(insets[dragged]).fill({ color: LEAD_COLOR, alpha: EMPTY_ALPHA });
        if (picked >= 0) {
            view.poly(insets[picked]).stroke({ color: LEAD_COLOR, width: OUTLINE_WIDTH + 2, join: 'round' });
            view.poly(insets[picked]).stroke({ color: PICKED_COLOR, width: OUTLINE_WIDTH, join: 'round' });
        }
        if (target >= 0) {
            view.poly(insets[target]).fill({ color: TARGET_COLOR, alpha: TARGET_ALPHA });
            view.poly(insets[target]).stroke({ color: LEAD_COLOR, width: OUTLINE_WIDTH + 2, join: 'round' });
            view.poly(insets[target]).stroke({ color: TARGET_COLOR, width: OUTLINE_WIDTH, join: 'round' });
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The outlines' width, and how bright the tile a drag is over goes. */
const OUTLINE_WIDTH = 2.5;
const TARGET_ALPHA = 0.18;
/** How dark the tile a piece was dragged from goes. */
const EMPTY_ALPHA = 0.75;
