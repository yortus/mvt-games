import type { TilePatch } from '../models';
import { layOutPicture } from './picture-layout';
import { LEAD_HALF_WIDTH } from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The shapes a board draws a window with, in the board's pixels: where the
 * window sits, and each tile's outline, glass and neighbours. They are
 * worked out once for each window, and never change. A polygon is a list of
 * x, y pairs, its corners in the order every tile goes round. The polygons'
 * own lists aren't typed read-only, only because Pixi's `poly` takes a
 * mutable list, though it never changes one.
 */
export interface BoardShapes {
    /** The middle of the window, and the pixels to a tile edge. */
    readonly centreX: number;
    readonly centreY: number;
    readonly scale: number;
    /** The top of the window's frame. */
    readonly windowTop: number;
    /** The radius of a free piece's ring, in pixels: a share of a tile edge, kept within a few pixels. */
    readonly ringRadius: number;
    /** Each tile's outline, through the middle of its lead. */
    readonly outers: readonly number[][];
    /** Each tile's glass, inside its lead. */
    readonly insets: readonly number[][];
    /**
     * Each piece's glass as it is drawn off its tile: a trimmed tile's whole
     * rhombus, part of which the frame hides while it is home, or the glass
     * on the tile.
     */
    readonly pieceShapes: readonly number[][];
    /**
     * The tile across each side of each tile, or -1 at the frame. A side is
     * numbered as the corner it starts at, so the side from corner `c` to the
     * next is `sideNeighbours[c]`.
     */
    readonly sideNeighbours: Readonly<Int32Array>;
    /** Where each tile is along the light's sweep across the window, from 0 to 1: across, and a little down. */
    readonly sweepPlaces: Readonly<Float64Array>;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BoardShapesOptions {
    /** The window's tiles. */
    readonly patch: TilePatch;
    /** The space the window is fitted into, and centred in, from the board's origin. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the shapes of a window's tiles, fitted into a space and centred in it. */
export function createBoardShapes(options: BoardShapesOptions): BoardShapes {
    const { patch, width, height } = options;
    const { count, cornerStarts, cornerXs, cornerYs, middleXs, middleYs, halfWidth, halfHeight } = patch;
    const { scale, centreX, centreY } = layOutPicture({ halfWidth, halfHeight, width, height });

    const outers: number[][] = [];
    const insets: number[][] = [];
    const pieceShapes: number[][] = [];
    let leftmost = Infinity;
    let rightmost = -Infinity;
    for (let t = 0; t < count; t++) {
        const outer: number[] = [];
        for (let c = cornerStarts[t]; c < cornerStarts[t + 1]; c++) outer.push(centreX + cornerXs[c] * scale, centreY + cornerYs[c] * scale);
        outers.push(outer);
        insets.push(insetPolygon(outer, LEAD_HALF_WIDTH));
        if (patch.trims[t] === 1) {
            const rhombus: number[] = [];
            for (let k = 0; k < 4; k++) rhombus.push(centreX + patch.rhombusXs[t * 4 + k] * scale, centreY + patch.rhombusYs[t * 4 + k] * scale);
            pieceShapes.push(insetPolygon(rhombus, LEAD_HALF_WIDTH));
        }
        else pieceShapes.push(insets[t]);
        leftmost = Math.min(leftmost, middleXs[t] + middleYs[t] * SWEEP_SLANT);
        rightmost = Math.max(rightmost, middleXs[t] + middleYs[t] * SWEEP_SLANT);
    }
    const sweepPlaces = new Float64Array(count);
    for (let t = 0; t < count; t++) sweepPlaces[t] = (middleXs[t] + middleYs[t] * SWEEP_SLANT - leftmost) / (rightmost - leftmost || 1);

    const sideNeighbours = new Int32Array(cornerStarts[count]).fill(-1);
    for (let t = 0; t < count; t++) {
        const near = patch.neighboursOf(t);
        for (let c = cornerStarts[t]; c < cornerStarts[t + 1]; c++) {
            const next = c + 1 < cornerStarts[t + 1] ? c + 1 : cornerStarts[t];
            for (let i = 0; i < near.length; i++) {
                if (!hasCorner(patch, near[i], cornerXs[c], cornerYs[c]) || !hasCorner(patch, near[i], cornerXs[next], cornerYs[next])) continue;
                sideNeighbours[c] = near[i];
                break;
            }
        }
    }

    return {
        centreX,
        centreY,
        scale,
        windowTop: centreY - halfHeight * scale,
        ringRadius: Math.max(RING_LEAST, Math.min(RING_MOST, scale * RING_SHARE)),
        outers,
        insets,
        pieceShapes,
        sideNeighbours,
        sweepPlaces,
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A free piece's ring's radius, as a share of a tile edge, kept between these in pixels. */
const RING_SHARE = 0.08;
const RING_LEAST = 3;
const RING_MOST = 4.5;

/** How far down the light's sweep slants as it goes across. */
const SWEEP_SLANT = 0.4;

/** Whether tile `tile` of `patch` has a corner at (`x`, `y`). */
function hasCorner(patch: TilePatch, tile: number, x: number, y: number): boolean {
    for (let c = patch.cornerStarts[tile]; c < patch.cornerStarts[tile + 1]; c++) {
        if (Math.abs(patch.cornerXs[c] - x) < CORNER_TOLERANCE && Math.abs(patch.cornerYs[c] - y) < CORNER_TOLERANCE) return true;
    }
    return false;
}

/** How close two corners are, in tile edges, to be taken as the same. */
const CORNER_TOLERANCE = 1e-6;

/**
 * The corners of a polygon, given as x, y pairs, round it the way every
 * tile goes, each moved inwards so every side moves `distance` in: the
 * glass inside its lead.
 */
function insetPolygon(points: readonly number[], distance: number): number[] {
    const n = points.length / 2;
    const inset: number[] = [];
    for (let k = 0; k < n; k++) {
        const px = points[((k + n - 1) % n) * 2];
        const py = points[((k + n - 1) % n) * 2 + 1];
        const cx = points[k * 2];
        const cy = points[k * 2 + 1];
        const nx = points[((k + 1) % n) * 2];
        const ny = points[((k + 1) % n) * 2 + 1];
        const [n1x, n1y] = inwardNormal(px, py, cx, cy);
        const [n2x, n2y] = inwardNormal(cx, cy, nx, ny);
        const along = distance / (1 + n1x * n2x + n1y * n2y);
        inset.push(cx + (n1x + n2x) * along, cy + (n1y + n2y) * along);
    }
    return inset;
}

/** The unit normal of the side from (ax, ay) to (bx, by) that points into its tile, given the way every tile goes round. */
function inwardNormal(ax: number, ay: number, bx: number, by: number): [number, number] {
    const length = Math.hypot(bx - ax, by - ay) || 1;
    return [-(by - ay) / length, (bx - ax) / length];
}
