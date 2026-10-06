import { MS_PER_BAR } from '../data';
import { hash01, smoothstep, TURN, wrap } from './show-math';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Part 4: the letters M, V and T as solid 3D shapes, turning over a starfield
 * of three layers moving at three speeds. The shapes are in object space
 * (`MVT_MESH` in this directory); this model says only how they are turned
 * and how far away they are.
 */
export interface VectorsPartModel {
    /** Turns about the vertical, horizontal and viewing axes, applied in that order. */
    readonly yaw: number;
    readonly pitch: number;
    readonly roll: number;
    /** How far the object is from the eye, in object units. */
    readonly distance: number;
    readonly starCount: number;
    /** Star `index`'s position, in fractional character columns (0-40) and rows (0-25). */
    starColAt: (index: number) => number;
    starRowAt: (index: number) => number;
    /** Star `index`'s layer: 0 is farthest and slowest, 2 nearest and fastest. */
    starLayerAt: (index: number) => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface VectorsPartModelOptions {
    /** Milliseconds into the part. */
    readonly elapsedMs: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createVectorsPartModel(options: VectorsPartModelOptions): VectorsPartModel {
    const { elapsedMs } = options;

    return {
        get yaw() {
            // Swinging about the front, with a full turn round twice in the part
            const t = elapsedMs();
            return 0.11 * Math.sin(TURN * (t / 5200))
                + smoothstep(MS_PER_BAR * 5, MS_PER_BAR * 7, t)
                + smoothstep(MS_PER_BAR * 11, MS_PER_BAR * 13, t);
        },
        get pitch() {
            return 0.05 * Math.sin(TURN * (elapsedMs() / 3700));
        },
        get roll() {
            return 0.03 * Math.sin(TURN * (elapsedMs() / 6100));
        },
        get distance() {
            // Flies in from far away over the first two bars
            return NEAR_DISTANCE + (FAR_DISTANCE - NEAR_DISTANCE) * (1 - smoothstep(0, MS_PER_BAR * 2, elapsedMs()));
        },
        starCount: STAR_COUNT,
        starColAt(index) {
            const layer = index % LAYER_COUNT;
            return wrap(hash01(index, 1) * 40 - (elapsedMs() / 1000) * LAYER_SPEEDS[layer], 40);
        },
        starRowAt(index) {
            return hash01(index, 2) * 25;
        },
        starLayerAt(index) {
            return index % LAYER_COUNT;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NEAR_DISTANCE = 7;
const FAR_DISTANCE = 60;

const STAR_COUNT = 90;
const LAYER_COUNT = 3;

/** Each layer's speed, in character columns a second. */
const LAYER_SPEEDS: readonly number[] = [1.5, 4, 9];
