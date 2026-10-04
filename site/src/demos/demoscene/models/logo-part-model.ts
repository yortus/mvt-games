import { MS_PER_BAR, type RampKind } from '../data';
import type { RasterBars } from './raster-bars';
import { smoothstep, TURN } from './show-math';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Part 2: the logo bounces in from below, then wobbles line by line, with
 * raster bars passing behind it and a sine scroller in the lower border.
 */
export interface LogoPartModel extends RasterBars {
    /** How far below its place the logo is, in character rows; 0 once it has landed. */
    readonly dropRows: number;
    /** How far the wobble swings each line of the logo, in character columns. */
    readonly wobbleCols: number;
    /** Where the wobble's wave is, in turns. */
    readonly wobblePhase: number;
    /** How far the border scroller has scrolled, in characters of its text, which starts off screen. */
    readonly scrollerOffset: number;
    /** Where the scroller's sine wave is, in turns. */
    readonly scrollerWavePhase: number;
    /** How far the subtitle's colour wash has moved, in steps of the colour cycle. */
    readonly washPhase: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface LogoPartModelOptions {
    /** Milliseconds into the part. */
    readonly elapsedMs: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createLogoPartModel(options: LogoPartModelOptions): LogoPartModel {
    const { elapsedMs } = options;

    return {
        get dropRows() {
            const u = elapsedMs() / DROP_MS;
            if (u >= 1) return 0;
            // A bounce that dies away: three and a half half-swings, each lower than the last
            return DROP_HEIGHT_ROWS * (1 - u) * (1 - u) * Math.abs(Math.cos(TURN * 1.75 * u));
        },
        get wobbleCols() {
            const t = elapsedMs();
            const swell = Math.sin(TURN * (t / 9600));
            return smoothstep(DROP_MS, DROP_MS + MS_PER_BAR, t) * (0.5 + 0.7 * swell * swell);
        },
        get wobblePhase() {
            return elapsedMs() / 1100;
        },
        barCount: BAR_RAMPS.length,
        barRowAt(index) {
            return 12.5 + 11.5 * Math.sin(TURN * (elapsedMs() / 4300 + index / BAR_RAMPS.length));
        },
        barRampAt(index) {
            return BAR_RAMPS[index];
        },
        get scrollerOffset() {
            const t = elapsedMs() - SCROLLER_START_MS;
            return t < 0 ? 0 : (t / 1000) * SCROLLER_CHARS_PER_SECOND;
        },
        get scrollerWavePhase() {
            return elapsedMs() / 1600;
        },
        get washPhase() {
            return elapsedMs() / 70;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The logo bounces in over two bars, from this far down. */
const DROP_MS = MS_PER_BAR * 2;
const DROP_HEIGHT_ROWS = 20;

const BAR_RAMPS: readonly RampKind[] = ['fire', 'ice', 'grass', 'plum'];

const SCROLLER_START_MS = MS_PER_BAR;
const SCROLLER_CHARS_PER_SECOND = 6.25;
