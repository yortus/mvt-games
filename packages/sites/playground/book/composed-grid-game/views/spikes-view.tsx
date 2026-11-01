/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { TILE_SIZE } from './view-constants';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** The spikes' colour, as 0xRRGGBB. */
const SPIKE_COLOR = 0xff5468;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SpikesViewBindings {
    /** How many rows and columns the grid has, read once. */
    readonly rows: number;
    readonly cols: number;
    /** Whether a cell has a spike in it. */
    readonly hasSpikeAt: (row: number, col: number) => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One layer of the grid: its spikes. There's a spike for each cell, drawn
 * once, and each one shows only while its cell has a spike.
 */
export function SpikesView(bindings: SpikesViewBindings): Container {
    const { rows, cols } = bindings;
    const spikes: Container[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            spikes.push(
                <graphics
                    x={col * TILE_SIZE}
                    y={row * TILE_SIZE}
                    visible={() => bindings.hasSpikeAt(row, col)}
                    ref={drawSpike}
                />,
            );
        }
    }
    return <container>{spikes}</container>;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function drawSpike(g: Graphics): void {
    const middle = TILE_SIZE / 2;
    g.poly([6, TILE_SIZE - 6, middle, 5, TILE_SIZE - 6, TILE_SIZE - 6]).fill(SPIKE_COLOR);
}
