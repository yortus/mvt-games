import type { ReelModel } from '../../models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Maps a linear 0-1 progress to an eased one. May overshoot 1 on the way, but ends at 1. */
export type Ease = (t: number) => number;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Where a reel should be drawn, with its landing eased. The model settles a
 * reel linearly; how the landing looks is up to each view, so each passes its
 * own ease. A pure function of the model, so the view keeps no state for it.
 */
export function shownReelPosition(reel: ReelModel, ease: Ease): number {
    if (reel.phase !== 'settling') return reel.position;
    return reel.stopIndex + (1 - ease(reel.progress)) * reel.settleDistance;
}

/** Overshoots by about a tenth and springs back: a modern, bouncy landing. */
export function easeOutBack(t: number): number {
    const u = t - 1;
    return 1 + BACK_C3 * u * u * u + BACK_C1 * u * u;
}

/**
 * Arrives fast, overshoots a little and rocks to rest: a heavy drum caught by
 * a mechanical stop.
 */
export function easeClunk(t: number): number {
    const raw = 1 - Math.exp(-CLUNK_DAMPING * t) * Math.cos(CLUNK_FREQUENCY * t);
    // Nudged so it ends exactly at 1
    return raw + t * (1 - CLUNK_END);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BACK_C1 = 1.70158;
const BACK_C3 = BACK_C1 + 1;
const CLUNK_DAMPING = 6;
const CLUNK_FREQUENCY = 11;
const CLUNK_END = 1 - Math.exp(-CLUNK_DAMPING) * Math.cos(CLUNK_FREQUENCY);
