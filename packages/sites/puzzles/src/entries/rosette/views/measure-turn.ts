import type { TilePatch } from '../models';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * The smallest turn, in radians, clockwise on screen, that takes the
 * rhombus of tile `from` onto the rhombus of tile `to`, when both are the
 * same shape, a rhombus trimmed by the frame as well as a whole one. A rhombus looks the same after a half turn, and a square
 * after a quarter turn, so the turn is never more than a quarter turn
 * either way. Tiles of different shapes give 0.
 *
 * Turning one rhombus onto another turns its two sides' directions onto the
 * other's two, in one order or the other. So each order is tried, and the
 * smaller turn that fits is kept.
 */
export function measureTurn(patch: TilePatch, from: number, to: number): number {
    const fromA = measureSide(patch, from, 0);
    const fromB = measureSide(patch, from, 1);
    const toA = measureSide(patch, to, 0);
    const toB = measureSide(patch, to, 1);
    let best = 0;
    let isFound = false;
    // The first side onto the other's first, or onto its second
    for (let order = 0; order < 2; order++) {
        const turn = toHalfTurnRange((order === 0 ? toA : toB) - fromA);
        const other = order === 0 ? toB : toA;
        if (Math.abs(toHalfTurnRange(fromB + turn - other)) > MATCH_TOLERANCE) continue;
        if (!isFound || Math.abs(turn) < Math.abs(best)) best = turn;
        isFound = true;
    }
    return best;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far apart two directions can be, in radians, and still be taken as the same. */
const MATCH_TOLERANCE = 1e-6;

/** The direction of a side of a tile's rhombus, from its corner `corner` to the next, in radians. */
function measureSide(patch: TilePatch, tile: number, corner: number): number {
    const at = tile * 4 + corner;
    return Math.atan2(patch.rhombusYs[at + 1] - patch.rhombusYs[at], patch.rhombusXs[at + 1] - patch.rhombusXs[at]);
}

/** An angle moved by half turns until it is more than a quarter turn back and at most a quarter turn on, since a side's direction is the same either way along it. */
function toHalfTurnRange(angle: number): number {
    let a = angle % Math.PI;
    if (a > Math.PI / 2) a -= Math.PI;
    if (a <= -Math.PI / 2) a += Math.PI;
    return a;
}
