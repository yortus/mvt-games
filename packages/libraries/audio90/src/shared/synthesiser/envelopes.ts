import { computeFall } from './synthesis';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A synthesiser's envelopes, each stepped one sample at a time. An
 * envelope's level rises over its attack to 1, falls over its decay to its
 * sustain level, holds there until it is released, then falls to 0 over its
 * release. Decay and release fall 60 dB over their time. A decay to a
 * sustain of 0, such as a drum's, ends the envelope as a release would.
 *
 * Each envelope's stage and level are in typed arrays, one slot an
 * envelope, so stepping them allocates nothing.
 */
export interface Envelopes {
    /** Each envelope's stage: `ENV_IDLE`, `ENV_ATTACK`, `ENV_DECAY`, `ENV_SUSTAIN` or `ENV_RELEASE`. */
    readonly stage: Int32Array;
    /** Each envelope's level, from 0 to 1. */
    readonly level: Float64Array;
    /**
     * Starts envelope `e`'s attack from its level now, so a note played over
     * another does not drop to silence first. Its decay and release take
     * `rateScale` times as long as `times` says.
     */
    start: (e: number, times: EnvelopeTimes, rateScale: number) => void;
    /** Moves envelope `e` on by one sample. */
    step: (e: number) => void;
    /** Starts envelope `e`'s release, unless it is idle. */
    release: (e: number) => void;
    /** Whether envelope `e` is still loud enough to hear, or is starting its attack. */
    isSounding: (e: number) => boolean;
    /** Makes every envelope idle, at level 0. */
    reset: () => void;
}

/** An envelope's shape: its attack, decay and release times, and its sustain level from 0 to 1. */
export interface EnvelopeTimes {
    readonly attackMs: number;
    readonly decayMs: number;
    readonly sustain: number;
    readonly releaseMs: number;
}

/** An envelope that has ended, or never started. */
export const ENV_IDLE = 0;
const ENV_ATTACK = 1;
const ENV_DECAY = 2;
const ENV_SUSTAIN = 3;
export const ENV_RELEASE = 4;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make `Envelopes`. */
export interface EnvelopesOptions {
    /** How many envelopes. */
    readonly count: number;
    /** The rate they step at, in samples a second. */
    readonly sampleRate: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates envelopes, every one idle. */
export function createEnvelopes(options: EnvelopesOptions): Envelopes {
    const { count } = options;
    const msPerSample = 1000 / options.sampleRate;
    const stage = new Int32Array(count);
    const level = new Float64Array(count);
    const attackInc = new Float64Array(count);
    const decayCoef = new Float64Array(count);
    const sustainLevel = new Float64Array(count);
    const releaseCoef = new Float64Array(count);

    return {
        stage,
        level,

        start(e, times, rateScale) {
            // The times are scaled here, not by the caller: a fractional number passed to a function V8 does not inline is boxed
            stage[e] = ENV_ATTACK;
            const attackSamples = times.attackMs / msPerSample;
            attackInc[e] = attackSamples <= 0 ? 1 : 1 / attackSamples;
            decayCoef[e] = computeFall(times.decayMs * rateScale, msPerSample);
            const sustain = times.sustain;
            sustainLevel[e] = sustain < 0 ? 0 : sustain > 1 ? 1 : sustain;
            releaseCoef[e] = computeFall(times.releaseMs * rateScale, msPerSample);
        },

        step(e) {
            let x = level[e];
            switch (stage[e]) {
                case ENV_ATTACK:
                    x += attackInc[e];
                    if (x >= 1) {
                        x = 1;
                        stage[e] = ENV_DECAY;
                    }
                    break;
                case ENV_DECAY: {
                    const sustain = sustainLevel[e];
                    x = sustain + (x - sustain) * decayCoef[e];
                    if (x - sustain < ENV_FLOOR) {
                        x = sustain;
                        stage[e] = sustain > 0 ? ENV_SUSTAIN : ENV_IDLE;
                    }
                    break;
                }
                case ENV_RELEASE:
                    x *= releaseCoef[e];
                    if (x < ENV_FLOOR) {
                        x = 0;
                        stage[e] = ENV_IDLE;
                    }
                    break;
            }
            level[e] = x;
        },

        release(e) {
            if (stage[e] !== ENV_IDLE) stage[e] = ENV_RELEASE;
        },

        isSounding(e) {
            const s = stage[e];
            if (s === ENV_IDLE) return false;
            return s === ENV_ATTACK || level[e] > SILENT_LEVEL;
        },

        reset() {
            stage.fill(ENV_IDLE);
            level.fill(0);
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The envelope ends its decay this close to the sustain level, and its release this close to 0 (80 dB down). */
const ENV_FLOOR = 1e-4;
/** Below this level, an envelope counts as silent, and its voice is free for a sound to play on. */
const SILENT_LEVEL = 1e-3;
