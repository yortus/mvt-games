import type { EffectData } from '../core';
import { createInstrument, type Instrument, type InstrumentOptions, parseNote } from './instrument';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A sound effect. It plays one note on an instrument, for a set length. Play it with `Audio80.play`. */
export interface SoundEffect {
    /** What the chip is sent. */
    readonly data: EffectData;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * How to make a sound effect. An effect plays `instrument` at `note`. Without
 * `instrument`, it plays an instrument made from the rest of these options,
 * usually a step table.
 */
export interface SoundEffectOptions extends Omit<InstrumentOptions, 'note' | 'volume'> {
    /** The instrument to play. Without it, the effect makes one from the instrument options here. Give one or the other, not both. */
    readonly instrument?: Instrument;
    /** The note to play. Defaults to the instrument's own note. */
    readonly note?: string;
    /** A note to glide to over the effect's length. */
    readonly glideTo?: string;
    /**
     * How long the note is held before its release, in ms. It must be above
     * 0. Defaults to the length of the step table, or 250 ms if there is none.
     */
    readonly lengthMs?: number;
    /** The effect's volume, 0 to 1. Defaults to 1. */
    readonly volume?: number;
    /** The effect's priority. It may take a voice only from an effect of no higher priority. Defaults to 0. */
    readonly priority?: number;
    /** How many voices it may play on at once. Playing it once more restarts its oldest voice. Defaults to 1. */
    readonly maxVoices?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a sound effect from `options`. Throws if they are not valid, such
 * as for a bad note, a length of 0 or less, or `instrument` given along with
 * instrument options.
 */
export function createSoundEffect(options: SoundEffectOptions): SoundEffect {
    // `volume` scales the effect's note, so keep it out of the instrument made here, which plays at full
    // volume. Keep `note` out too, so a bad note is reported as the effect's
    const { instrument: given, note, glideTo, lengthMs, volume, priority, maxVoices, ...instrumentOptions } = options;
    if (given !== undefined) {
        const extra = Object.keys(instrumentOptions).filter((key) => instrumentOptions[key as keyof typeof instrumentOptions] !== undefined);
        if (extra.length > 0) {
            throw new Error(`effect: give either an instrument or the options to make one, not both; found ${extra.join(', ')} with the instrument`);
        }
    }
    const instrument = given ?? createInstrument(instrumentOptions);
    const steps = instrument.data.steps.length;
    const length = lengthMs ?? (steps > 0 ? steps * instrument.data.stepMs : DEFAULT_LENGTH_MS);
    if (!(length > 0)) throw new Error(`effect: lengthMs must be above 0; got ${length}`);
    const data: EffectData = {
        instrument: instrument.data,
        note: note === undefined ? instrument.note : parseNote(note, 'effect note'),
        glideTo: glideTo === undefined ? Number.NaN : parseNote(glideTo, 'effect glideTo'),
        lengthMs: length,
        volume: volume ?? 1,
        priority: priority ?? 0,
        maxVoices: Math.max(1, maxVoices ?? 1),
    };
    const effect: SoundEffect = Object.freeze({ data });
    EFFECTS.add(effect);
    return effect;
}

/** Whether `value` is an effect that `createSoundEffect` made, such as one found among a module's exports. */
export function isSoundEffect(value: unknown): value is SoundEffect {
    return typeof value === 'object' && value !== null && EFFECTS.has(value);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_LENGTH_MS = 250;

/** Every effect made, so `isSoundEffect` knows one when it sees it. */
const EFFECTS = new WeakSet<object>();
