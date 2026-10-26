import { computeSongDurationMs } from '../../shared';
import { AUDIO90_SAMPLE_MEMORY, type Audio90SampleData } from '../synthesiser';
import { bounceAudio90Song } from './bounce';
import { checkRange, parseNote } from './instrument';
import type { Audio90Song } from './song';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A sample for the Audio90: a sound that a sample instrument plays, faster
 * for higher notes and slower for lower ones. No sample is recorded. Each is
 * a short song that the chip bounces: it plays the song on its own engines,
 * and keeps what it rendered.
 *
 * The chip sends a sample to its synthesiser the first time an instrument
 * that plays it is played, and copies it rather than moving it, so one sample
 * serves every chip.
 */
export interface Audio90Sample {
    /** The chip it plays on. */
    readonly chip: 'audio90';
    /**
     * Its sound, and how it plays. The first read bounces the song, which
     * can take a few frames' time, so an entry calls `prepareAudio90Samples`
     * as it loads to read it then.
     */
    readonly data: Audio90SampleData;
    /** How many equal slices it is cut into, or 1 for none. A song's `s` token plays one. */
    readonly slices: number;
    /** How many samples it holds, which is what it takes of the chip's sample memory. */
    readonly length: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What `createAudio90Sample` makes a sample from: a song to bounce, and how to keep what it renders. */
export interface Audio90SampleOptions {
    /** The song to bounce. It plays once, from its start. Its reverb, echo and chorus are silent unless it sets them. */
    readonly bounce: Audio90Song;
    /** The sample's own rate, in Hz, from 8,000 to 32,000. A lower rate is duller and grittier, as the era's samplers were. Defaults to 32,000. */
    readonly rate?: number;
    /** How many bits each sample keeps: 8, 12 or 16. Fewer is noisier. Defaults to 16. */
    readonly bits?: 8 | 12 | 16;
    /** The note the sample sounds at its own rate, such as the note the song plays. Defaults to `C-4`. */
    readonly rootNote?: string;
    /** How long to keep, in ms. Defaults to one pass through the song. */
    readonly lengthMs?: number;
    /** How many equal slices to cut it into, from 1 to 256, for a song's `s` token to play one of. A sliced sample does not loop. Defaults to 1. */
    readonly slices?: number;
    /** A part of it to repeat while the note is held. Defaults to none, so the sample plays once. */
    readonly loop?: Audio90SampleLoop;
}

/** The part of a sample that repeats while its note is held. */
export interface Audio90SampleLoop {
    /** Where the loop starts, in ms from the sample's start. */
    readonly fromMs: number;
    /** Where it ends, in ms, after `fromMs`. */
    readonly toMs: number;
    /** Whether it plays back and forth rather than jumping back to its start. Defaults to false. */
    readonly isPingPong?: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a sample from `options`. It checks them now, but bounces the song
 * only when its `data` is first read. Throws if an option is not valid, such
 * as a loop that ends past the sample's end.
 */
export function createAudio90Sample(options: Audio90SampleOptions): Audio90Sample {
    const rate = checkRange(options.rate ?? DEFAULT_RATE, MIN_RATE, MAX_RATE, 'rate', 'sample');
    const bits = options.bits ?? 16;
    if (!BITS.includes(bits)) throw new Error(`sample: bits: ${bits} is not one of ${BITS.join(', ')}`);
    const rootNote = options.rootNote === undefined ? DEFAULT_ROOT_NOTE : parseNote(options.rootNote, 'sample: rootNote');
    const lengthMs = checkRange(options.lengthMs ?? computeSongDurationMs(options.bounce), Number.MIN_VALUE, Infinity, 'lengthMs', 'sample');
    const length = Math.max(1, Math.round(lengthMs * rate / 1000));
    const slices = options.slices ?? 1;
    if (!(Number.isInteger(slices) && slices >= 1 && slices <= MAX_SLICES)) throw new Error(`sample: slices: ${slices} is not a whole number from 1 to ${MAX_SLICES}`);
    const loop = options.loop;
    if (loop !== undefined && slices > 1) throw new Error('sample: a sliced sample cannot loop');
    if (loop !== undefined && !(loop.fromMs >= 0 && loop.toMs > loop.fromMs && loop.toMs <= lengthMs)) {
        throw new Error(`sample: loop: from ${loop.fromMs} ms to ${loop.toMs} ms is not a part of the sample's ${lengthMs} ms`);
    }

    let data: Audio90SampleData | undefined;
    const sample: Audio90Sample = Object.freeze({
        chip: 'audio90',
        slices,
        length,
        get data() {
            if (data === undefined) {
                const bounced = bounceAudio90Song({ song: options.bounce, sampleRate: rate, bits, lengthMs });
                data = Object.freeze({
                    data: bounced,
                    sampleRate: rate,
                    rootNote,
                    loopStart: loop === undefined ? -1 : Math.round(loop.fromMs * rate / 1000),
                    loopEnd: loop === undefined ? -1 : Math.min(length, Math.round(loop.toMs * rate / 1000)),
                    isPingPong: loop?.isPingPong ?? false,
                    slices,
                });
            }
            return data;
        },
    });
    return sample;
}

/**
 * Bounces each of `samples` that is not bounced yet, so that none is
 * bounced while a game plays. Call it in an entry's `load`, beside its
 * textures. Throws if the samples need more than the chip's sample memory
 * between them, `AUDIO90_SAMPLE_MEMORY` samples, listing each one's size.
 */
export function prepareAudio90Samples(samples: readonly Audio90Sample[]): void {
    let total = 0;
    for (const sample of samples) total += sample.length;
    if (total > AUDIO90_SAMPLE_MEMORY) {
        const sizes = samples.map((sample, i) => `sample ${i}: ${sample.length}`).join(', ');
        throw new Error(`prepareAudio90Samples: these samples need ${total} samples of memory, more than the chip's ${AUDIO90_SAMPLE_MEMORY} (${sizes})`);
    }
    // Reading each one's data bounces it, once
    for (const sample of samples) void sample.data;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_RATE = 32000;
const MIN_RATE = 8000;
const MAX_RATE = 32000;
const BITS: readonly number[] = [8, 12, 16];
const DEFAULT_ROOT_NOTE = 60;
const MAX_SLICES = 256;
