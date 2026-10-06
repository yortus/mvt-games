import { MS_PER_BAR } from '../data';
import { smoothstep, TURN } from './show-math';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Part 5: 48 balls, six times as many sprites as the machine has. They start
 * as a spinning sphere, become six waving rows, and go back.
 *
 * The balls are in six rings (or rows) of eight, `ringOf(index)` being
 * `Math.floor(index / 8)`, and every ring stays at one height, at least
 * `MIN_RING_GAP_ROWS` from the next. However the balls move within their
 * rings, no screen line ever crosses more than eight of them: the limit the
 * machine's sprite multiplexer has to live with.
 */
export interface SpritesPartModel {
    readonly ballCount: number;
    /** Ball `index`'s centre, in fractional character columns and rows. */
    ballColAt: (index: number) => number;
    ballRowAt: (index: number) => number;
    /** How near ball `index` is: -1 at the back, 1 at the front. */
    ballDepthAt: (index: number) => number;
    /** 0 for the sphere, 1 for the rows. */
    readonly morph: number;
}

/** Balls per ring, which is how many sprites the machine can show on one line. */
export const BALLS_PER_RING = 8;
export const RING_COUNT = 6;

/** The least distance between rings, in character rows: just more than a sprite is tall (21 lines). */
export const MIN_RING_GAP_ROWS = 22 / 8;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SpritesPartModelOptions {
    /** Milliseconds into the part. */
    readonly elapsedMs: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSpritesPartModel(options: SpritesPartModelOptions): SpritesPartModel {
    const { elapsedMs } = options;

    return {
        ballCount: BALLS_PER_RING * RING_COUNT,
        ballColAt(index) {
            const t = elapsedMs();
            const m = morphAt(t);
            return CENTRE_COL + (1 - m) * sphereX(index, t) + m * rowsX(index, t);
        },
        ballRowAt(index) {
            const t = elapsedMs();
            const m = morphAt(t);
            const ring = Math.floor(index / BALLS_PER_RING);
            return CENTRE_ROW + (1 - m) * SPHERE_RING_ROWS[ring] + m * rowsY(ring, t);
        },
        ballDepthAt(index) {
            const t = elapsedMs();
            const m = morphAt(t);
            return (1 - m) * Math.sin(sphereAngle(index, t)) + m * Math.cos(rowsAngle(index, t));
        },
        get morph() {
            return morphAt(elapsedMs());
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CENTRE_COL = 20;
const CENTRE_ROW = 12.5;

/** The sphere's radius, in rows (eight lines each), and its rings' heights from the centre. */
const SPHERE_RADIUS_ROWS = 62 / 8;
const SPHERE_RING_ROWS: readonly number[] = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map((k) => k * MIN_RING_GAP_ROWS);

/**
 * The rows formation: rows this far apart, bobbing up and down by this much.
 * Two rows bobbing towards each other are still more than a sprite apart,
 * and the top and bottom rows keep clear of the captions on rows 0 and 24.
 */
const ROW_GAP_ROWS = 30 / 8;
const ROW_BOB_ROWS = 3 / 8;

/** The sphere for four bars, the rows from five to nine, the sphere again from ten. */
function morphAt(t: number): number {
    return smoothstep(MS_PER_BAR * 4, MS_PER_BAR * 5, t) - smoothstep(MS_PER_BAR * 9, MS_PER_BAR * 10, t);
}

function sphereAngle(index: number, t: number): number {
    const ring = Math.floor(index / BALLS_PER_RING);
    return TURN * ((index % BALLS_PER_RING) / BALLS_PER_RING + t / 5200 + ring * 0.0625);
}

/** A ball's distance right of centre on the sphere, in columns. Pixels are as wide as lines are tall. */
function sphereX(index: number, t: number): number {
    const ring = Math.floor(index / BALLS_PER_RING);
    const height = SPHERE_RING_ROWS[ring];
    const radius = Math.sqrt(SPHERE_RADIUS_ROWS * SPHERE_RADIUS_ROWS - height * height);
    return radius * Math.cos(sphereAngle(index, t));
}

function rowsAngle(index: number, t: number): number {
    const ring = Math.floor(index / BALLS_PER_RING);
    return TURN * (t / 4100 + (index % BALLS_PER_RING) / BALLS_PER_RING + ring * 0.07);
}

function rowsX(index: number, t: number): number {
    return 16.5 * Math.sin(rowsAngle(index, t));
}

function rowsY(ring: number, t: number): number {
    return (ring - 2.5) * ROW_GAP_ROWS + ROW_BOB_ROWS * Math.sin(TURN * (t / 1700 + ring / RING_COUNT));
}
