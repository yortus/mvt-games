import { Graphics } from 'pixi.js';
import type { BoardLayout } from './board-layout';
import { scatter } from './scatter';
import { GRASS_COLOR, MEADOW_COLOR, MEADOW_SHADE_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Makes the meadow that covers a valley of `size` cells along each side,
 * placed by `layout`. Its cells are chequered in two greens, and a few blades
 * of grass are scattered over it, the same way each time.
 */
export function makeMeadow(size: number, layout: BoardLayout): Graphics {
    const { cellSize, gridX, gridY } = layout;
    const meadow = new Graphics().rect(gridX, gridY, size * cellSize, size * cellSize).fill(MEADOW_COLOR);
    for (let cell = 0; cell < size * size; cell++) {
        const row = Math.floor(cell / size);
        const col = cell % size;
        if ((row + col) % 2 === 1) meadow.rect(gridX + col * cellSize, gridY + row * cellSize, cellSize, cellSize);
    }
    meadow.fill(MEADOW_SHADE_COLOR);
    const blade = cellSize * BLADE_SHARE;
    for (let i = 0; i < size * size * BLADES_PER_CELL; i++) {
        const x = gridX + scatter(i, 5) * size * cellSize;
        const y = gridY + scatter(i, 6) * size * cellSize;
        meadow.moveTo(x - blade * 0.5, y - blade).lineTo(x, y).lineTo(x + blade * 0.4, y - blade * 1.1);
    }
    meadow.stroke({ color: GRASS_COLOR, width: Math.max(1, cellSize * 0.03), cap: 'round', join: 'round' });
    return meadow;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many blades of grass there are for each cell. */
const BLADES_PER_CELL = 1.2;

/** How tall a blade of grass is, as a share of a cell. */
const BLADE_SHARE = 0.07;
