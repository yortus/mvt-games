/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import type { TileKind } from '../models';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** The size of a cell on the minimap, in pixels. */
const CELL_SIZE = 5;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MinimapViewBindings {
    /** How many rows and columns the grid has, read once. */
    readonly rows: number;
    readonly cols: number;
    readonly tileKindAt: (row: number, col: number) => TileKind;
    /** Where the ship is, in cells. */
    readonly shipRow: () => number;
    readonly shipCol: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole grid, small, with a blip for the ship. It reads the same state
 * as the grid's layers and the ship do, so it's up to date from its first frame,
 * and no other view needed to change for it. Each cell is a square drawn
 * once in white, and tinted by its tile's kind.
 */
export function MinimapView(bindings: MinimapViewBindings): Container {
    const { rows, cols } = bindings;
    const cells: Container[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            cells.push(
                <graphics
                    x={col * CELL_SIZE}
                    y={row * CELL_SIZE}
                    tint={() => COLOR_OF_KIND[bindings.tileKindAt(row, col)]}
                    ref={drawCell}
                />,
            );
        }
    }

    return (
        <container>
            <graphics ref={(g) => g.rect(-3, -3, cols * CELL_SIZE + 6, rows * CELL_SIZE + 6).stroke({ color: 0x4a66c8, width: 1 })} />
            {cells}
            <graphics
                x={() => (bindings.shipCol() + 0.5) * CELL_SIZE}
                y={() => (bindings.shipRow() + 0.5) * CELL_SIZE}
                ref={drawBlip}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const COLOR_OF_KIND: Readonly<Record<TileKind, number>> = {
    empty: 0x0a0f24,
    wall: 0x4a66c8,
    dot: 0x8a7a40,
    spike: 0xff5468,
};

function drawCell(g: Graphics): void {
    g.rect(0, 0, CELL_SIZE, CELL_SIZE).fill(0xffffff);
}

function drawBlip(g: Graphics): void {
    g.circle(0, 0, 3).fill(0x7fe07f);
}
