import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { drawGrid } from './draw-grid';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What both grid views need. GoodView and BadView differ only in how they read it. */
export interface GridViewBindings {
    readonly rows: () => number;
    readonly cols: () => number;
    /** The size of each tile, in pixels. Read once. */
    readonly tileSize: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A grid of tiles, with the middle of its top edge at the view's origin.
 * It reads the rows and columns every frame, so it follows the model to a
 * new level.
 */
export function GoodView(bindings: GridViewBindings): Container {
    const view = new Container();
    const grid = new Graphics();
    view.addChild(grid);

    // What the grid was last drawn with, so that it's drawn again only when they change
    let drawnRows = 0;
    let drawnCols = 0;

    function refresh(): void {
        const rows = bindings.rows(); // always current
        const cols = bindings.cols();
        if (rows !== drawnRows || cols !== drawnCols) {
            drawGrid(grid, rows, cols, bindings.tileSize);
            drawnRows = rows;
            drawnCols = cols;
        }
    }

    setRefresh(view, refresh);
    return view;
}
