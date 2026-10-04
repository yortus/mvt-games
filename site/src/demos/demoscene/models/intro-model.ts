import { INTRO_CAPTIONS, MS_PER_BAR, type RampKind } from '../data';
import type { RasterBars } from './raster-bars';
import { clamp01, smoothstep, TURN } from './show-math';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Part 1: raster bars roll in from the top and bottom and cross, while captions fade up and down. */
export interface IntroModel extends RasterBars {
    /** Which of `INTRO_CAPTIONS` is showing, or -1 for none. */
    readonly captionIndex: number;
    /** The caption's brightness, 0 to 1, for its fade through the palette. */
    readonly captionBrightness: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface IntroModelOptions {
    /** Milliseconds into the part. */
    readonly elapsedMs: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createIntroModel(options: IntroModelOptions): IntroModel {
    const { elapsedMs } = options;

    return {
        barCount: BAR_RAMPS.length,
        barRowAt(index) {
            const t = elapsedMs();
            // Where the bar swings once it is in, crossing the others
            const swing = 12.5 + 9 * Math.sin(TURN * (t / 3200 + index / BAR_RAMPS.length));
            // Rolled in from above (even bars) or below (odd ones) over the first bar and a half
            const start = index % 2 === 0 ? -4 : 29;
            const arrived = smoothstep(index * 300, MS_PER_BAR * 1.5 + index * 300, t);
            return start + (swing - start) * arrived;
        },
        barRampAt(index) {
            return BAR_RAMPS[index];
        },
        get captionIndex() {
            const slot = captionSlot(elapsedMs());
            return slot < INTRO_CAPTIONS.length ? slot : -1;
        },
        get captionBrightness() {
            const t = elapsedMs();
            const slot = captionSlot(t);
            if (slot >= INTRO_CAPTIONS.length) return 0;
            const into = t - CAPTIONS_START_MS - slot * CAPTION_MS;
            return clamp01(Math.min(into / CAPTION_FADE_MS, (CAPTION_MS - CAPTION_GAP_MS - into) / CAPTION_FADE_MS));
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BAR_RAMPS: readonly RampKind[] = ['ice', 'fire', 'grass'];

/** The captions start on the second bar, and each has three: two and a half shown, then a gap. */
const CAPTIONS_START_MS = MS_PER_BAR;
const CAPTION_MS = MS_PER_BAR * 3;
const CAPTION_GAP_MS = MS_PER_BAR * 0.5;
const CAPTION_FADE_MS = 700;

/** Which caption's time slot `t` falls in; past the last caption's slot (or before the first) is `INTRO_CAPTIONS.length`. */
function captionSlot(t: number): number {
    if (t < CAPTIONS_START_MS) return INTRO_CAPTIONS.length;
    return Math.floor((t - CAPTIONS_START_MS) / CAPTION_MS);
}
