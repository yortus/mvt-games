/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { TILE_SIZE } from './view-constants';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How big a dot is: its radius, in pixels. */
const DOT_RADIUS = 4;
/** The dots' colour, as 0xRRGGBB. */
const DOT_COLOR = 0xffe08a;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DotsViewBindings {
    /** How many rows and columns the grid has, read once. */
    readonly rows: number;
    readonly cols: number;
    /** Whether a cell has a dot in it. */
    readonly hasDotAt: (row: number, col: number) => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One layer of the grid: its dots. There's a dot for each cell, drawn once,
 * and each one shows only while its cell has a dot. So a dot goes as it's
 * collected, and comes back as the grid is refilled, with nothing redrawn.
 */
export function DotsView(bindings: DotsViewBindings): Container {
    const { rows, cols } = bindings;
    const dots: Container[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            dots.push(
                <graphics
                    x={col * TILE_SIZE}
                    y={row * TILE_SIZE}
                    visible={() => bindings.hasDotAt(row, col)}
                    ref={drawDot}
                />,
            );
        }
    }
    return <container>{dots}</container>;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function drawDot(g: Graphics): void {
    g.circle(TILE_SIZE / 2, TILE_SIZE / 2, DOT_RADIUS).fill(DOT_COLOR);
}
