import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { CellKind } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BoardViewBindings {
    readonly rows: number;
    readonly cols: number;
    /** The width and height of one cell, in pixels. */
    readonly cellSize: number;
    readonly kindAt: (row: number, col: number) => CellKind;
    /** Where a cell's cactus is now, in rows, which may be between two cells. */
    readonly cactusRowAt: (row: number, col: number) => number;
    /** Where a cell's cactus is now, in columns. */
    readonly cactusColAt: (row: number, col: number) => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A board of cactii, with its top left corner at 0, 0. Each cactus is drawn
 * once, in white, and each refresh moves it and tints it the colour of its
 * kind.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const { rows, cols, cellSize } = bindings;
    const view = new Container();

    const tiles = new Graphics();
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            tiles.roundRect(col * cellSize + 2, row * cellSize + 2, cellSize - 4, cellSize - 4, 6);
        }
    }
    tiles.fill(0x1c2a1c);
    view.addChild(tiles);

    // One cactus for each cell, by row * cols + col
    const cactii: Graphics[] = [];
    for (let i = 0; i < rows * cols; i++) {
        const cactus = drawCactus();
        cactii.push(cactus);
        view.addChild(cactus);
    }

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const cactus = cactii[row * cols + col];
                const kind = bindings.kindAt(row, col);
                cactus.visible = kind !== 'empty';
                cactus.tint = COLORS[kind];
                cactus.position.set(
                    (bindings.cactusColAt(row, col) + 0.5) * cellSize,
                    (bindings.cactusRowAt(row, col) + 0.5) * cellSize,
                );
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The colour of each kind of cactus. An empty cell's cactus is hidden. */
const COLORS: Record<CellKind, number> = {
    empty: 0xffffff,
    green: 0x55cc66,
    pink: 0xff77aa,
    blue: 0x55aaff,
    gold: 0xffcc44,
};

/** A cactus with two arms, in white, centred on 0, 0, so a tint gives it any colour. */
function drawCactus(): Graphics {
    const g = new Graphics();
    g.roundRect(-7, -18, 14, 36, 7);
    g.roundRect(-18, -8, 7, 14, 3.5);
    g.roundRect(-18, 2, 14, 6, 3);
    g.roundRect(11, -14, 7, 14, 3.5);
    g.roundRect(4, -4, 14, 6, 3);
    g.fill(0xffffff);
    return g;
}
