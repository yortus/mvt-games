import type { Audio90EffectData } from '../synthesiser';
import { type Audio90Instrument, type Audio90InstrumentOptions, checkRange, createAudio90Instrument, parseNote } from './instrument';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A sound effect for the Audio90. It plays one note on an instrument, for a set length. Play it with `Audio90.play`. */
export interface Audio90SoundEffect {
    /** The chip it plays on. */
    readonly chip: 'audio90';
    /** What the chip is sent. */
    readonly data: Audio90EffectData;
    /** The instrument it plays, whose sample, if it has one, the chip sends with it. */
    readonly instrument: Audio90Instrument;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * How to make an Audio90 sound effect. An effect plays `instrument` at
 * `note`. Without `instrument`, it plays an instrument made from the rest of
 * these options. Its pan and sends are its own, so they may be given with an
 * instrument too.
 */
export interface Audio90SoundEffectOptions extends Omit<Audio90InstrumentOptions, 'note' | 'volume' | 'pan' | 'reverb' | 'echo' | 'chorus'> {
    /** The instrument to play. Without it, the effect makes one from the instrument options here. Give one or the other, not both. */
    readonly instrument?: Audio90Instrument;
    /** The note to play. Defaults to the instrument's own note. */
    readonly note?: string;
    /** A note to glide to over the effect's length. */
    readonly glideTo?: string;
    /** How long the note is held before its release, in ms, above 0. Defaults to the length of the step table, or 250 ms if there is none. */
    readonly lengthMs?: number;
    /** The effect's volume, 0 or more. Defaults to 1. */
    readonly volume?: number;
    /** Where it plays, from -1 (left) to 1 (right), unless `play` is given a pan. Defaults to 0, the centre. */
    readonly pan?: number;
    /** How much goes to the reverb, 0 to 1. Defaults to the instrument's. */
    readonly reverb?: number;
    /** How much goes to the echo, 0 to 1. Defaults to the instrument's. */
    readonly echo?: number;
    /** How much goes to the chorus, 0 to 1. Defaults to the instrument's. */
    readonly chorus?: number;
    /** The effect's priority. It may take a voice only from an effect of no higher priority. Defaults to 0. */
    readonly priority?: number;
    /** How many voices it may play on at once. Playing it once more restarts its oldest voice. Defaults to 1. */
    readonly maxVoices?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Audio90 sound effect from `options`. Throws if they are not
 * valid, such as for a bad note, a length of 0 or less, or `instrument`
 * given along with instrument options.
 */
export function createAudio90SoundEffect(options: Audio90SoundEffectOptions): Audio90SoundEffect {
    const { instrument: given, note, glideTo, lengthMs, volume, pan, reverb, echo, chorus, priority, maxVoices, ...instrumentOptions } = options;
    if (given !== undefined) {
        const extra = Object.keys(instrumentOptions).filter((key) => instrumentOptions[key as keyof typeof instrumentOptions] !== undefined);
        if (extra.length > 0) {
            throw new Error(`effect: give either an instrument or the options to make one, not both; found ${extra.join(', ')} with the instrument`);
        }
    }
    const instrument = given ?? createAudio90Instrument(instrumentOptions);
    const steps = instrument.data.steps.length;
    const length = lengthMs ?? (steps > 0 ? steps * instrument.data.stepMs : DEFAULT_LENGTH_MS);
    if (!(length > 0)) throw new Error(`effect: lengthMs must be above 0; got ${length}`);
    const sends = {
        reverb: checkRange(reverb ?? instrument.data.reverb, 0, 1, 'reverb', 'effect'),
        echo: checkRange(echo ?? instrument.data.echo, 0, 1, 'echo', 'effect'),
        chorus: checkRange(chorus ?? instrument.data.chorus, 0, 1, 'chorus', 'effect'),
    };
    const hasOwnSends = sends.reverb !== instrument.data.reverb || sends.echo !== instrument.data.echo || sends.chorus !== instrument.data.chorus;
    const data: Audio90EffectData = Object.freeze({
        instrument: hasOwnSends ? Object.freeze({ ...instrument.data, ...sends }) : instrument.data,
        note: note === undefined ? instrument.data.note : parseNote(note, 'effect: note'),
        glideTo: glideTo === undefined ? Number.NaN : parseNote(glideTo, 'effect: glideTo'),
        lengthMs: length,
        volume: checkRange(volume ?? 1, 0, Infinity, 'volume', 'effect'),
        pan: checkRange(pan ?? 0, -1, 1, 'pan', 'effect'),
        priority: priority ?? 0,
        maxVoices: Math.max(1, maxVoices ?? 1),
    });
    const effect: Audio90SoundEffect = Object.freeze({ chip: 'audio90', data, instrument });
    EFFECTS.add(effect);
    return effect;
}

/** Whether `value` is an effect that `createAudio90SoundEffect` made, such as one found among a module's exports. */
export function isAudio90SoundEffect(value: unknown): value is Audio90SoundEffect {
    return typeof value === 'object' && value !== null && EFFECTS.has(value);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_LENGTH_MS = 250;

/** Every effect made, so `isAudio90SoundEffect` knows one when it sees it. */
const EFFECTS = new WeakSet<object>();
