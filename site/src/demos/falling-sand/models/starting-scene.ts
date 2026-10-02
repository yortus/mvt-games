import type { GrainGrid, GrainKind } from './grain-grid';
import { LEDGE_THICKNESS } from './model-constants';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Fill an empty grid with the scene the demo opens with, and resets to: a
 * dune along the floor, and two sloping ledges, one holding a heap of sand and
 * the other a pool of water. The heap overhangs its ledge and the water flows
 * downhill, so both start pouring off straight away.
 *
 * Laid out in fractions of the grid's size, so it fits any grid.
 * Deterministic: no randomness.
 */
export function addStartingScene(grid: GrainGrid): void {
    const { cols, rows } = grid;

    // Dune along the floor: two overlapping swells.
    for (let col = 0; col < cols; col++) {
        const x = col / cols;
        const swell = 0.6 + 0.4 * Math.sin(x * Math.PI * 2.2 + 0.4);
        const height = Math.round(rows * 0.12 * swell);
        fillRect(grid, col, rows - height, 1, height, 'sand');
    }

    // Left ledge from the left wall, sloping down to the right; sand on it.
    const leftLedgeEnd = Math.round(cols * 0.46);
    addLedge(grid, 0, Math.round(rows * 0.4), leftLedgeEnd, Math.round(rows * 0.47));
    // The heap overhangs the ledge's open end, so its right flank pours off.
    addHeap(grid, Math.round(cols * 0.2), Math.round(rows * 0.4) - 1, Math.round(cols * 0.32), 'sand');

    // Right ledge from the right wall, sloping down to the left; water on it.
    const rightLedgeStart = Math.round(cols * 0.56);
    addLedge(grid, cols - 1, Math.round(rows * 0.2), rightLedgeStart, Math.round(rows * 0.27));
    fillRect(
        grid,
        Math.round(cols * 0.68),
        Math.round(rows * 0.08),
        Math.round(cols * 0.3),
        Math.round(rows * 0.1),
        'water',
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A wall line from one end to the other, `LEDGE_THICKNESS` cells deep. */
function addLedge(grid: GrainGrid, fromCol: number, fromRow: number, toCol: number, toRow: number): void {
    const length = Math.max(Math.abs(toCol - fromCol), Math.abs(toRow - fromRow));
    for (let i = 0; i <= length; i++) {
        const t = i / length;
        const col = Math.round(fromCol + (toCol - fromCol) * t);
        const row = Math.round(fromRow + (toRow - fromRow) * t);
        fillRect(grid, col, row, 1, LEDGE_THICKNESS, 'wall');
    }
}

/** A triangular heap, `width` cells wide at its base, whose base row is `baseRow`. */
function addHeap(grid: GrainGrid, leftCol: number, baseRow: number, width: number, kind: GrainKind): void {
    const half = width / 2;
    for (let i = 0; i < width; i++) {
        const height = Math.round(half - Math.abs(i - half));
        fillRect(grid, leftCol + i, baseRow - height + 1, 1, height, kind);
    }
}

function fillRect(grid: GrainGrid, col: number, row: number, width: number, height: number, kind: GrainKind): void {
    for (let r = row; r < row + height; r++) {
        for (let c = col; c < col + width; c++) grid.add(c, r, kind);
    }
}
