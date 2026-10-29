// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A synthesiser's fade: a gain on its whole output that moves evenly in
 * decibels, so it sounds even to the ear, between full volume and
 * `FADE_FLOOR_DB`. A fade-out ends at silence, and the synthesiser then cuts
 * every voice and empties its effects, and goes back to full volume, so
 * nothing faded comes back. A fade-in starts from the floor.
 */
export interface Fade {
    /** The gain now, in `gain[0]`, from 0 to 1. It is 1 unless a fade is under way. Read it every sample; never write it. */
    readonly gain: Float64Array;
    /**
     * Starts a fade over `ms`, in from the floor if `isIn`, or out from the
     * gain now. A fade-in over 0 ms or less goes to full volume at once, and
     * a fade-out over 0 ms or less ends at the next sample.
     */
    start: (isIn: boolean, ms: number) => void;
    /**
     * Moves the fade on by one sample. Returns true on the sample a fade-out
     * reaches silence, so the synthesiser cuts every voice, as the gain goes
     * back to 1.
     */
    step: () => boolean;
    /** Ends any fade at full volume, as the synthesiser resets. */
    reset: () => void;
}

/** How far down a fade goes, in dB, before a fade-out ends in silence and a fade-in starts. */
export const FADE_FLOOR_DB = -60;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FadeOptions {
    /** The rate the synthesiser renders at, in samples a second. */
    readonly sampleRate: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a fade at full volume, with none under way. */
export function createFade(options: FadeOptions): Fade {
    const { sampleRate } = options;
    // The gain now, the factor it changes by each sample, how many samples are left, and 1 for a fade-out. They
    // are kept in a typed array, since V8 boxes a double kept in a closure variable each time it is written
    const state = new Float64Array(STATE_COUNT);
    const gain = state.subarray(GAIN, GAIN + 1);
    state[GAIN] = 1;

    return {
        gain,

        start(isIn, ms) {
            const samples = Math.round(ms * sampleRate / 1000);
            if (isIn && samples <= 0) {
                state[GAIN] = 1;
                state[SAMPLES_LEFT] = 0;
                return;
            }
            const from = isIn ? FLOOR : state[GAIN];
            const to = isIn ? 1 : FLOOR;
            const count = Math.max(1, samples);
            state[GAIN] = from;
            // The same factor each sample makes the gain move evenly in dB. The chips never call Math.pow, which
            // can differ in its last digit from one system to the next
            state[FACTOR] = Math.exp(Math.log(to / from) / count);
            state[SAMPLES_LEFT] = count;
            state[IS_OUT] = isIn ? 0 : 1;
        },

        step() {
            if (state[SAMPLES_LEFT] <= 0) return false;
            state[GAIN] *= state[FACTOR];
            state[SAMPLES_LEFT]--;
            if (state[SAMPLES_LEFT] > 0) return false;
            state[GAIN] = 1;
            return state[IS_OUT] === 1;
        },

        reset() {
            state[GAIN] = 1;
            state[SAMPLES_LEFT] = 0;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** `FADE_FLOOR_DB` as a gain. */
const FLOOR = Math.exp(FADE_FLOOR_DB / 20 * Math.LN10);

// Each value's place in the fade's state
const GAIN = 0;
const FACTOR = 1;
const SAMPLES_LEFT = 2;
const IS_OUT = 3;
const STATE_COUNT = 4;
