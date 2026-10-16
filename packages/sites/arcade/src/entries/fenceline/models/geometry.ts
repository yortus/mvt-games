// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

// Distances in the meadow, in cells, between places given by row and column.

/** Something at a place in the meadow. */
export interface Placed {
    readonly row: number;
    readonly col: number;
}

/** Returns the squared distance from (row0, col0) to (row1, col1). */
export function measureDistanceSquared(row0: number, col0: number, row1: number, col1: number): number {
    const dRow = row1 - row0;
    const dCol = col1 - col0;
    return dRow * dRow + dCol * dCol;
}

/** Returns the squared distance from (row, col) to the line segment from (row0, col0) to (row1, col1). */
export function measureSegmentDistanceSquared(
    row: number, col: number, row0: number, col0: number, row1: number, col1: number,
): number {
    const dRow = row1 - row0;
    const dCol = col1 - col0;
    const lengthSquared = dRow * dRow + dCol * dCol;
    let t = lengthSquared === 0 ? 0 : ((row - row0) * dRow + (col - col0) * dCol) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    return measureDistanceSquared(row, col, row0 + dRow * t, col0 + dCol * t);
}

/** Whether (row, col) is at least `spacing` cells from everything in `placed`. */
export function isClearOf(placed: readonly Placed[], row: number, col: number, spacing: number): boolean {
    for (let i = 0; i < placed.length; i++) {
        if (measureDistanceSquared(placed[i].row, placed[i].col, row, col) < spacing * spacing) return false;
    }
    return true;
}
