import { PAGE_HEIGHT, PAGE_WIDTH } from '../data';
import type { PaperLayout, TurnDirection } from '../models';
import { FIELD_OF_VIEW, LEAF_Y, SCREEN_HEIGHT } from './view-constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Where the reader's eyes are as they read, and how a point in their view
// meets the paper. The camera view and the taps on the paper both use these,
// so a tap lands on what the reader sees under it.

/** The way the camera's top points, toward the tops of the pages. Looking straight down at a page, it still has a top. */
export const CAMERA_UP = { x: 0, y: 0, z: -1 } as const;

/** Where the reader is in the paper: the spread open, the page turning, if one is, and which page holds each spread's puzzle. */
export interface ReadingPosition {
    readonly spread: number;
    readonly spreadCount: number;
    readonly turnDirection: TurnDirection;
    readonly turnProgress: number;
    readonly layout: PaperLayout;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns where across the desk the reader looks, in a view `viewWidth`
 * pixels wide. For an open spread, that's the spine, if the view takes in
 * both pages. A narrower view, such as a phone's held upright, can't. Then
 * the reader looks across toward the page with the puzzle, until its outer
 * edge is in view, and at its middle at most. A page is upright, as a phone
 * is, so the whole page fits. While the paper lies closed, the reader looks
 * at the middle of the front page, and at the end, of the back page. While
 * a page turns, it eases from one to the next.
 */
export function findReadingCentre(reading: ReadingPosition, viewWidth: number): number {
    const { spread, spreadCount, turnDirection, turnProgress, layout } = reading;
    const reach = TAN_HALF_FOV * (viewWidth / SCREEN_HEIGHT) * NEAR_DISTANCE - EDGE_MARGIN;
    const from = centreOf(spread, spreadCount, layout, reach);
    if (turnProgress <= 0) return from;
    const to = centreOf(spread + (turnDirection === 'forward' ? 1 : -1), spreadCount, layout, reach);
    const t = turnProgress * turnProgress * (3 - 2 * turnProgress);
    return from + (to - from) * t;
}

/** Writes where the reader's eyes are, reading, looking at `centreX`, into `eye`. */
export function placeReadingEye(centreX: number, eye: { x: number; y: number; z: number }): void {
    eye.x = centreX;
    eye.y = Math.sin(ELEVATION) * DISTANCE;
    eye.z = TARGET_Z + Math.cos(ELEVATION) * DISTANCE;
}

/** Writes the point the reader looks at, reading, into `target`. */
export function placeReadingTarget(centreX: number, target: { x: number; y: number; z: number }): void {
    target.x = centreX;
    target.y = 0;
    target.z = TARGET_Z;
}

/**
 * Writes the point on the open pages under the point `viewX`, `viewY` in
 * the reader's view, in pixels, into `out`, as the reader looks at
 * `centreX`, in a view `viewWidth` pixels wide. The pages lie flat while the reader reads, so the point is
 * where the line of sight meets their height above the desk.
 */
export function findPaperPoint(viewX: number, viewY: number, viewWidth: number, centreX: number, out: { x: number; z: number }): void {
    placeReadingEye(centreX, eye);
    placeReadingTarget(centreX, target);
    // The camera's own axes: back, away from where it looks, then right and up, as a camera's lookAt makes them
    let bx = eye.x - target.x;
    let by = eye.y - target.y;
    let bz = eye.z - target.z;
    const backLength = Math.hypot(bx, by, bz);
    bx /= backLength;
    by /= backLength;
    bz /= backLength;
    let rx = CAMERA_UP.y * bz - CAMERA_UP.z * by;
    let ry = CAMERA_UP.z * bx - CAMERA_UP.x * bz;
    let rz = CAMERA_UP.x * by - CAMERA_UP.y * bx;
    const rightLength = Math.hypot(rx, ry, rz);
    rx /= rightLength;
    ry /= rightLength;
    rz /= rightLength;
    const ux = by * rz - bz * ry;
    const uy = bz * rx - bx * rz;
    const uz = bx * ry - by * rx;
    const across = ((viewX * 2 - viewWidth) / SCREEN_HEIGHT) * TAN_HALF_FOV;
    const up = (1 - (viewY / SCREEN_HEIGHT) * 2) * TAN_HALF_FOV;
    const dx = -bx + rx * across + ux * up;
    const dy = -by + ry * across + uy * up;
    const dz = -bz + rz * across + uz * up;
    const distance = (LEAF_Y - eye.y) / dy;
    out.x = eye.x + dx * distance;
    out.z = eye.z + dz * distance;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far the reader looks down at the paper, from level, and how far away they are, in metres. */
const ELEVATION = (64 * Math.PI) / 180;
const DISTANCE = 1.04;
/** The point the reader looks at, a little below the middle of the pages, toward the reader. */
const TARGET_Z = 0.015;
const TAN_HALF_FOV = Math.tan((FIELD_OF_VIEW * Math.PI) / 360);
/** The camera's place and aim, worked out afresh for each point, so a tap makes no objects. */
const eye = { x: 0, y: 0, z: 0 };
const target = { x: 0, y: 0, z: 0 };

/**
 * How far either side of where the reader looks the view takes in, across
 * the nearest edge of the pages, where it takes in least, for each unit of
 * the view's width over its height. And how far in from the view's edge a
 * page's edge is kept.
 */
const NEAR_DISTANCE = DISTANCE - (PAGE_HEIGHT / 2) * Math.cos(ELEVATION);
const EDGE_MARGIN = 0.015;

/**
 * Where across the desk the reader looks on `spread`, with the view taking
 * in `reach` either side. The front page and the back page lie alone, so
 * it's their middles. A spread with a puzzle shows its page whole.
 */
function centreOf(spread: number, spreadCount: number, layout: PaperLayout, reach: number): number {
    if (spread <= 0) return PAGE_WIDTH / 2;
    if (spread >= spreadCount - 1) return -PAGE_WIDTH / 2;
    const page = layout.spreads[spread].puzzlePage;
    if (page === undefined) return 0;
    // Spread s shows pages[2s - 1] on the left, and pages[2s] on the right
    const side = page === spread * 2 - 1 ? -1 : 1;
    return side * Math.min(PAGE_WIDTH / 2, Math.max(0, PAGE_WIDTH - reach));
}
