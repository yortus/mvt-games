// What every chip's synthesiser computes the same way: the rate its
// controls run at, its filters' tuning, its band-limited waves, and keeping
// its states clear of numbers too small to hear.

/** Samples between a synthesiser's updates of its voices' pitches, filters and steps: about 0.7 ms at 48 kHz. */
export const CONTROL_SAMPLES = 32;

/** The lowest cutoff a filter takes, in Hz. */
export const MIN_CUTOFF_HZ = 20;

/** The highest cutoff a filter takes, as a share of the sample rate. It is kept below half, where a filter stops working. */
export const MAX_CUTOFF_SHARE = 0.45;

/** The most of each echo's repeat that is fed back into the next. */
export const MAX_ECHO_FEEDBACK = 0.95;

/**
 * How much of its last output the DC blocker keeps each sample. The DC
 * blocker removes any steady offset from zero in the output (DC, short for
 * direct current).
 */
export const DC_POLE = 0.9995;

/** Below this size, a state is set to 0 by `clearTinyValues`, before it can become subnormal. */
export const TINY = 1e-20;

/** How many numbers a state-variable filter's coefficients take, in the array `tuneStateVariableFilter` writes. */
export const SVF_STRIDE = 4;
/** Where in a state-variable filter's coefficients its damping is, which the high-pass output reads. */
export const SVF_K = 0;
export const SVF_A1 = 1;
export const SVF_A2 = 2;
export const SVF_A3 = 3;

/** The per-sample factor that makes a level fall 60 dB over `ms`, or 0 for an instant fall. */
export function computeFall(ms: number, msPerSample: number): number {
    return ms <= 0 ? 0 : Math.exp(LN_FALL / (ms / msPerSample));
}

/**
 * Tunes the state-variable filter whose coefficients start at `at` in
 * `coefficients`, from `g`, which is `Math.tan(Math.PI * cutoffHz /
 * sampleRate)`, and its resonance from 0 to 1.
 *
 * A state-variable filter gives a low-pass, a band-pass and a high-pass
 * output from one pair of states. Its sample is:
 *
 *     v3 = input - ic2
 *     v1 = a1 * ic1 + a2 * v3          (the band-pass)
 *     v2 = ic2 + a2 * ic1 + a3 * v3    (the low-pass)
 *     ic1 = 2 * v1 - ic1
 *     ic2 = 2 * v2 - ic2
 *     high-pass = input - k * v1 - v2
 */
export function tuneStateVariableFilter(coefficients: Float64Array, at: number, g: number, resonance: number): void {
    const k = 2 - 1.98 * resonance;
    const a1 = 1 / (1 + g * (g + k));
    coefficients[at + SVF_K] = k;
    coefficients[at + SVF_A1] = a1;
    coefficients[at + SVF_A2] = g * a1;
    coefficients[at + SVF_A3] = g * g * a1;
}

/**
 * The correction for a jump in a wave at phase 0, for an oscillator moving
 * `dt` of a cycle each sample. Subtracted from a falling jump, or added to a
 * rising one, it smooths the jump over a sample either side by a polynomial,
 * so the wave does not alias (add harsh false tones). The method is called
 * polyBLEP.
 */
export function polyBlep(p: number, dt: number): number {
    if (p < dt) {
        const t = p / dt;
        return t + t - t * t - 1;
    }
    if (p > 1 - dt) {
        const t = (p - 1) / dt;
        return t * t + t + t + 1;
    }
    return 0;
}

/**
 * Sets each of `values` that is too small to hear to 0. With no input, the
 * states of filters, echoes and DC blockers shrink towards 0 without ever
 * reaching it. Numbers that small are called subnormal, and they make the
 * processor's arithmetic many times slower. The test is written so that a
 * NaN fails it too, and is cleared.
 */
export function clearTinyValues(values: Float64Array, from = 0, to = values.length): void {
    for (let i = from; i < to; i++) {
        if (!(Math.abs(values[i]) >= TINY)) values[i] = 0;
    }
}

export function clamp(x: number, low: number, high: number): number {
    return x < low ? low : x > high ? high : x;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Decay and release fall 60 dB over their time. */
const LN_FALL = Math.log(1e-3);
