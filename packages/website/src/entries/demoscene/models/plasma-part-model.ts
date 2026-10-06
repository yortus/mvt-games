// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Part 3: a full-screen plasma, the sum of three moving sine waves, cycling
 * through the colours, with a DYCP scroller weaving across it.
 */
export interface PlasmaPartModel {
    /** The three waves' phases, in turns. */
    readonly phaseA: number;
    readonly phaseB: number;
    readonly phaseC: number;
    /** How far the colours have cycled, in steps of the colour cycle. */
    readonly cycleOffset: number;
    /** How far the DYCP scroller has scrolled, in characters of its text, which starts off screen. */
    readonly dycpOffset: number;
    /** Where the DYCP scroller's wave is, in turns. */
    readonly dycpWavePhase: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PlasmaPartModelOptions {
    /** Milliseconds into the part. */
    readonly elapsedMs: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPlasmaPartModel(options: PlasmaPartModelOptions): PlasmaPartModel {
    const { elapsedMs } = options;

    return {
        get phaseA() { return elapsedMs() / 2900; },
        get phaseB() { return -elapsedMs() / 4100; },
        get phaseC() { return elapsedMs() / 6700; },
        get cycleOffset() { return elapsedMs() / 110; },
        get dycpOffset() { return (elapsedMs() / 1000) * DYCP_CHARS_PER_SECOND; },
        get dycpWavePhase() { return elapsedMs() / 1300; },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DYCP_CHARS_PER_SECOND = 9;
