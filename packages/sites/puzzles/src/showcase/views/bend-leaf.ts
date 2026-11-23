import { PAGE_HEIGHT, PAGE_WIDTH } from '../data';
import type { TurnDirection } from '../models';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How many strips a leaf bends in, across its width. */
export const LEAF_SEGMENTS = 32;
/** How many points a leaf has: a row along its top edge, and one along its foot. */
export const LEAF_VERTEX_COUNT = (LEAF_SEGMENTS + 1) * 2;

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Bends a leaf of the paper as it turns, writing each point's place, and
 * the way its front faces, into `positions` and `normals`, three numbers a
 * point. The leaf is hinged at the spine, along z, at x 0. At `turn` 0 it
 * lies flat to the right, its front up. At 1 it lies flat to the left, its
 * back up.
 *
 * A turning page doesn't swing stiffly. It's lifted by its outer edge, so
 * the edge leads, and the page curls between the edge and the spine. Each
 * strip of the leaf, out from the spine, is turned a little further than
 * the last, so the leaf bends evenly. The curl is greatest halfway over,
 * and brings the edge down flat at either end, never through the desk.
 * Each strip keeps its width, so the page never stretches.
 */
export function bendLeaf(turn: number, direction: TurnDirection, positions: Float32Array, normals: Float32Array): void {
    const spineAngle = Math.PI * turn;
    const curl = CURL * Math.sin(Math.PI * turn);
    // Forward, the edge leads toward the left, a larger angle. Back, it leads toward the right
    const lead = direction === 'forward' ? Math.min(curl, Math.PI - spineAngle) : -Math.min(curl, spineAngle);
    const stripWidth = PAGE_WIDTH / LEAF_SEGMENTS;
    let x = 0;
    let y = 0;
    for (let i = 0; i <= LEAF_SEGMENTS; i++) {
        const angle = spineAngle + (lead * i) / LEAF_SEGMENTS;
        writePoint(i, x, y, -Math.sin(angle), Math.cos(angle), positions, normals);
        // Each strip lies at the angle of its middle
        const middle = spineAngle + (lead * (i + 0.5)) / LEAF_SEGMENTS;
        x += Math.cos(middle) * stripWidth;
        y += Math.sin(middle) * stripWidth;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far the edge leads the spine halfway over, in radians. */
const CURL = 1.1;

/** Writes the point `i` out from the spine, along both the top edge and the foot. */
function writePoint(i: number, x: number, y: number, normalX: number, normalY: number, positions: Float32Array, normals: Float32Array): void {
    const top = i * 3;
    const foot = (i + LEAF_SEGMENTS + 1) * 3;
    positions[top] = x;
    positions[top + 1] = y;
    positions[top + 2] = -PAGE_HEIGHT / 2;
    positions[foot] = x;
    positions[foot + 1] = y;
    positions[foot + 2] = PAGE_HEIGHT / 2;
    normals[top] = normalX;
    normals[top + 1] = normalY;
    normals[top + 2] = 0;
    normals[foot] = normalX;
    normals[foot + 1] = normalY;
    normals[foot + 2] = 0;
}
