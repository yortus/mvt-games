import { CREDITS } from '../data';
import { clamp01 } from './show-math';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Part 6: the credits scroll up, colour-washed, and stop with the last line mid-screen. */
export interface CreditsModel {
    /**
     * How far the credits have scrolled, in fractional character rows: line
     * `n` of `CREDITS` is on screen row `n - scrollRows`. Starts at -25, all
     * the text below the screen.
     */
    readonly scrollRows: number;
    /** How far the colour wash has moved, in steps of the colour cycle. */
    readonly washPhase: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CreditsModelOptions {
    /** Milliseconds into the part. */
    readonly elapsedMs: () => number;
    /** How long the part plays. The scroll ends two bars before. */
    readonly durationMs: number;
    readonly msPerBar: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCreditsModel(options: CreditsModelOptions): CreditsModel {
    const { elapsedMs, durationMs, msPerBar } = options;
    const scrollMs = durationMs - msPerBar * 2;
    // From all below the screen to the last line on row 12
    const startRows = -25;
    const endRows = CREDITS.length - 1 - 12;

    return {
        get scrollRows() {
            return startRows + (endRows - startRows) * clamp01(elapsedMs() / scrollMs);
        },
        get washPhase() {
            return elapsedMs() / 60;
        },
    };
}
