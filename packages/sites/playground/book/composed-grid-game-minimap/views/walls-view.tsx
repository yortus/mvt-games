/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { TILE_SIZE } from './view-constants';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** The colour inside a wall, as 0xRRGGBB. */
const WALL_FILL = 0x24387a;
/** The colour of a wall's edge, as 0xRRGGBB. */
const WALL_EDGE = 0x4a66c8;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface WallsViewBindings {
    /** How many rows and columns the grid has, read once. */
    readonly rows: number;
    readonly cols: number;
    /** Whether a cell is a wall. */
    readonly isWallAt: (row: number, col: number) => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One layer of the grid: its walls. There's a block for each cell, drawn
 * once, and each one shows only while its cell is a wall. The view knows
 * nothing of dots, spikes or the player. The game view stacks the other
 * layers on top of it.
 */
export function WallsView(bindings: WallsViewBindings): Container {
    const { rows, cols } = bindings;
    const blocks: Container[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            blocks.push(
                <graphics
                    x={col * TILE_SIZE}
                    y={row * TILE_SIZE}
                    visible={() => bindings.isWallAt(row, col)}
                    ref={drawWall}
                />,
            );
        }
    }
    return <container>{blocks}</container>;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function drawWall(g: Graphics): void {
    g.roundRect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2, 5).fill(WALL_FILL).stroke({ color: WALL_EDGE, width: 2 });
}
