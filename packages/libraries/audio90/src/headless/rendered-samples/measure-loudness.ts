import { listChannels, type RenderedSamples } from './stereo-samples';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The loudness every song is written to, in LUFS, as `measureLoudness`
 * measures it. LUFS is a standard unit of how loud sound seems to the ear.
 * Writing every song to this level keeps any one from being much louder than
 * another, in one game or across games. The listener's volume settings are
 * set against it.
 */
export const REFERENCE_LOUDNESS_LUFS = -20;

/** How far a song may be from `REFERENCE_LOUDNESS_LUFS`, either way, in LU. One LU is one dB of loudness. */
export const LOUDNESS_TOLERANCE_LU = 3;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Measures the integrated (whole-sound) loudness of `samples`, in LUFS, as
 * ITU-R BS.1770-4 defines it. Streaming services use the same measure to
 * even out loudness. YouTube, for example, turns louder videos down to about
 * -14. Returns -Infinity for silence.
 *
 * The samples are first weighted to match the ear's sensitivity, which is
 * called K-weighting. Their power is averaged over 400 ms blocks that
 * overlap by 75%. Quiet blocks are left out: first those under -70 LUFS,
 * then those more than 10 LU below the rest.
 *
 * BS.1770 adds up the power of every speaker. Stereo sound's two channels
 * are added up so. Mono sound, as from the Audio80, is measured as a browser
 * plays it, on both speakers, so its power is counted twice. That reads
 * 3.01 dB above the same samples on one speaker, and the same as stereo
 * sound with those samples on both sides. A 1 kHz tone at -20 dBFS measures
 * -20 LUFS, in mono or on both sides.
 */
export function measureLoudness(samples: RenderedSamples, sampleRate = DEFAULT_SAMPLE_RATE): number {
    const channels = listChannels(samples);
    const weighted = channels.map((channel) => applyKWeighting(channel, sampleRate));
    // Mono sound plays on both speakers
    const speakers = channels.length === 1 ? 2 : 1;
    const length = weighted[0].length;
    const blockLength = Math.round(BLOCK_S * sampleRate);
    const hop = Math.round(blockLength * (1 - BLOCK_OVERLAP));
    const powers: number[] = [];
    for (let start = 0; start + blockLength <= length; start += hop) {
        let sum = 0;
        for (const channel of weighted) {
            for (let i = start; i < start + blockLength; i++) sum += channel[i] * channel[i];
        }
        powers.push(speakers * sum / blockLength);
    }
    const aboveAbsolute = powers.filter((power) => toLoudness(power) > ABSOLUTE_GATE_LUFS);
    if (aboveAbsolute.length === 0) return -Infinity;
    const relativeGate = toLoudness(computeMean(aboveAbsolute)) - RELATIVE_GATE_LU;
    const aboveRelative = aboveAbsolute.filter((power) => toLoudness(power) > relativeGate);
    return toLoudness(computeMean(aboveRelative));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_SAMPLE_RATE = 48000;
const BLOCK_S = 0.4;
const BLOCK_OVERLAP = 0.75;
const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_LU = 10;

// The K-weighting has two stages, as BS.1770 defines them. The first is a
// high shelf, which boosts high frequencies to model the head's effect. The
// second is a high-pass filter. BS.1770 gives their coefficients at 48 kHz
// only. These constants describe the analog filters that match them, as
// libebur128 derives them, so the stages can be made at any sample rate.
const SHELF_HZ = 1681.974450955533;
const SHELF_GAIN_DB = 3.999843853973347;
const SHELF_Q = 0.7071752369554196;
/** The shelf's gain at its band edge, Vb, sets its slope. Vb is Vh to this power, which is libebur128's value. */
const SHELF_VB_EXPONENT = 0.4996667741545416;
const HIGH_PASS_HZ = 38.13547087602444;
const HIGH_PASS_Q = 0.5003270373238773;

/** Converts a mean power to loudness in LUFS, by BS.1770's formula. Its -0.691 cancels the K-weighting's gain at 1 kHz. */
function toLoudness(power: number): number {
    return -0.691 + 10 * Math.log10(power);
}

function computeMean(values: readonly number[]): number {
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum += values[i];
    return sum / values.length;
}

function applyKWeighting(x: Float32Array, sampleRate: number): Float64Array {
    const shelfK = Math.tan(Math.PI * SHELF_HZ / sampleRate);
    const vh = Math.exp(SHELF_GAIN_DB / 20 * Math.LN10);
    const vb = Math.exp(SHELF_VB_EXPONENT * Math.log(vh));
    const shelfA0 = 1 + shelfK / SHELF_Q + shelfK * shelfK;
    const shelf = applyBiquad(
        x,
        [(vh + vb * shelfK / SHELF_Q + shelfK * shelfK) / shelfA0, 2 * (shelfK * shelfK - vh) / shelfA0, (vh - vb * shelfK / SHELF_Q + shelfK * shelfK) / shelfA0],
        [2 * (shelfK * shelfK - 1) / shelfA0, (1 - shelfK / SHELF_Q + shelfK * shelfK) / shelfA0],
    );
    const passK = Math.tan(Math.PI * HIGH_PASS_HZ / sampleRate);
    const passA0 = 1 + passK / HIGH_PASS_Q + passK * passK;
    return applyBiquad(shelf, [1, -2, 1], [2 * (passK * passK - 1) / passA0, (1 - passK / HIGH_PASS_Q + passK * passK) / passA0]);
}

/**
 * Runs one biquad filter, a common kind of small digital filter, in direct
 * form I. `b` holds the feed-forward coefficients. `a` holds the feedback
 * ones after a0, which is 1.
 */
function applyBiquad(x: ArrayLike<number>, b: readonly number[], a: readonly number[]): Float64Array {
    const y = new Float64Array(x.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < x.length; i++) {
        const out = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
        x2 = x1;
        x1 = x[i];
        y2 = y1;
        y1 = out;
        y[i] = out;
    }
    return y;
}
