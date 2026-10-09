// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Converts a volume slider's position, from 0 to 1, to a gain. The gain is
 * the position squared. Loudness is heard on a log scale, so a slider that
 * set the gain directly would barely change the sound over most of its
 * travel. Half way down, it would be only 6 dB quieter. Squared, half way
 * down is 12 dB quieter, which sounds a little under half as loud, and a
 * quarter of the way up is 24 dB quieter. At 1 the gain is 1, so a song
 * plays at the loudness it was written to (`REFERENCE_LOUDNESS_LUFS`, from
 * `@mvtjs/audio/headless`).
 */
export function toSliderGain(position: number): number {
    const clamped = Math.max(0, Math.min(1, position));
    return clamped ** SLIDER_CURVE;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The power that a slider's position is raised to. */
const SLIDER_CURVE = 2;
