import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { CactusKind } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BoardViewBindings {
    readonly rows: number;
    readonly cols: number;
    /** The width and height of one cell, in pixels. */
    readonly cellSize: number;
    readonly kindAt: (row: number, col: number) => CactusKind;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A board of cactii, with its top left corner at 0, 0. Each cactus is drawn
 * once, in white, and each refresh tints it the colour of its kind.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const { rows, cols, cellSize, kindAt } = bindings;
    const view = new Container();

    const tiles = new Graphics();
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            tiles.roundRect(col * cellSize + 2, row * cellSize + 2, cellSize - 4, cellSize - 4, 5);
        }
    }
    tiles.fill(0x1c2a1c);
    view.addChild(tiles);

    // One cactus for each cell, by row * cols + col
    const cactii: Graphics[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cactus = drawCactus(cellSize / 52);
            cactus.position.set((col + 0.5) * cellSize, (row + 0.5) * cellSize);
            cactii.push(cactus);
            view.addChild(cactus);
        }
    }

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                cactii[row * cols + col].tint = COLORS[kindAt(row, col)];
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The colour of each kind of cactus. */
const COLORS: Record<CactusKind, number> = {
    green: 0x55cc66,
    pink: 0xff77aa,
    blue: 0x55aaff,
    gold: 0xffcc44,
};

/** A cactus with two arms, in white, centred on 0, 0, sized for a cell 52 pixels wide times `scale`. */
function drawCactus(scale: number): Graphics {
    const g = new Graphics();
    g.roundRect(-7, -18, 14, 36, 7);
    g.roundRect(-18, -8, 7, 14, 3.5);
    g.roundRect(-18, 2, 14, 6, 3);
    g.roundRect(11, -14, 7, 14, 3.5);
    g.roundRect(4, -4, 14, 6, 3);
    g.fill(0xffffff);
    g.scale.set(scale);
    return g;
}
