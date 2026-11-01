import { Container, Graphics } from 'pixi.js';
import { drawGrid } from './draw-grid';
import type { GridViewBindings } from './good-view';

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Don't do this: the grid's size is read once, when the view is made. Its
 * bindings promise to follow a change, since they're getters, but the view
 * never reads them again, so it keeps showing level 1's grid.
 */
export function BadView(bindings: GridViewBindings): Container {
    const view = new Container();
    const rows = bindings.rows(); // never read again
    const cols = bindings.cols();

    const grid = new Graphics();
    drawGrid(grid, rows, cols, bindings.tileSize);
    view.addChild(grid);

    return view;
}
