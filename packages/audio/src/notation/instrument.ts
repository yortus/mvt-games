import {
    toCutoff,
    DEFAULT_STEP_MS,
    type FilterId,
    toFilterRoute,
    HIGHEST_NOTE_NAME,
    type InstrumentData,
    MAX_ARPEGGIO,
    toNoteNumber,
    type StepData,
    type Wave,
    WAVETABLE_SIZE,
    toWaveFlags,
} from '../core';
import { parseHexToken, isNoteInRange, parseRelativePitch, splitRows, splitTokens, parseWaveToken } from './tokens';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An instrument. It holds a voice's starting settings, and what changes while
 * a note plays: an arpeggio, vibrato, pulse and filter sweeps, and a step
 * table. A song's patterns, a sound effect or a direct `noteOn` call can play
 * it.
 */
export interface Instrument {
    /** What the chip is sent. */
    readonly data: InstrumentData;
    /** The filter its notes go through, if any. */
    readonly filter: FilterId | undefined;
    /** The note it plays when a song's cell names it without a note, as drum cells do. */
    readonly note: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What `createInstrument` makes an instrument from. Every option has a default. */
export interface InstrumentOptions {
    /** The waveform. Defaults to `'pulse'`. */
    readonly wave?: Wave;
    /** The pulse's width, 0 to 1. Defaults to 0.5, a square wave. */
    readonly pulseWidth?: number;
    /** The `wavetable` wave's shape, as 32 hex digits. Each digit is a level from 0 to F. Spaces are ignored. */
    readonly wavetable?: string;
    /** Defaults to a near-instant attack, full sustain and a short release. */
    readonly envelope?: Envelope;
    /** The instrument's volume, 0 to 1. Defaults to 1. */
    readonly volume?: number;
    /** The filter, `a` or `b`, its notes go through. Defaults to none. */
    readonly filter?: FilterId;
    /** How much goes to the echo, 0 to 1. Defaults to 0. */
    readonly echo?: number;
    /** The note it plays when a song names it without a note, such as `C-4`. Defaults to `C-4`. */
    readonly note?: string;
    /** How long each step of `steps` and `arpeggio` lasts, in ms. Defaults to 1/60 s. */
    readonly stepMs?: number;
    /**
     * A step table, which changes the note's settings step by step. It is a
     * multiline string, with one step on each line, and the last step holds.
     * A `#` at the start of a line or after a space starts a comment, which
     * runs to the end of the line, so a table can have column headings.
     * Blank lines and comment lines are not steps. A step may set any of
     * these:
     *
     * - a wave, such as `noise`
     * - a pitch: `+7` or `-12` from the note, or a note such as `C-5`
     * - a volume, `v0` to `vF`
     * - a pulse width in sixteenths, `p0` to `pF`
     * - a filter cutoff, `f0` to `fF`
     */
    readonly steps?: string;
    /**
     * Semitone offsets from the note, played one per step in a cycle. For
     * example, `[0, 4, 7]` plays a major chord. At most `MAX_ARPEGGIO` are
     * allowed.
     */
    readonly arpeggio?: readonly number[];
    /** A wobble in pitch. Defaults to none. */
    readonly vibrato?: Vibrato;
    /** A pulse width that moves from `pulseWidth` while the note plays. Defaults to none. */
    readonly pulseSweep?: PulseSweep;
    /** A filter cutoff that moves while the note plays. Defaults to none. */
    readonly filterSweep?: FilterSweep;
    /** The voice whose cycle restarts this voice's cycle, if any. This is called hard sync. */
    readonly syncSource?: number;
    /** The voice whose phase flips this voice's triangle wave, if any. This is called ring modulation. */
    readonly ringSource?: number;
}

/** How a note's loudness rises, falls and dies away. */
export interface Envelope {
    /** How long it takes to rise from silence to its peak, in ms. */
    readonly attackMs: number;
    /** How long it takes to fall from its peak towards `sustain`, in ms. The gap between them falls 60 dB over this time. */
    readonly decayMs: number;
    /** The level it holds after its decay, from 0 to 1, until the note is released. */
    readonly sustain: number;
    /** How long it takes to fall 60 dB once the note is released, in ms. */
    readonly releaseMs: number;
}

/** A wobble in pitch. */
export interface Vibrato {
    /** The most it bends the pitch either way, in semitones. */
    readonly semitones: number;
    /** How many times a second it wobbles. */
    readonly hz: number;
    /** How long a note holds before its vibrato starts, in ms. Defaults to 0. */
    readonly delayMs?: number;
}

/** A pulse width that moves while a note plays. */
export interface PulseSweep {
    /** The width it sweeps to from `pulseWidth`, 0 to 1. */
    readonly to: number;
    /** How long one sweep takes, in ms. */
    readonly ms: number;
    /** Whether it sweeps back and forth, rather than once. */
    readonly isPingPong?: boolean;
}

/** A filter cutoff that moves while a note plays. */
export interface FilterSweep {
    /** The cutoff it starts at, in Hz. It must be above 0. */
    readonly fromHz: number;
    /** The cutoff it ends at, in Hz. It must be above 0. */
    readonly toHz: number;
    /** How long the sweep takes, in ms. */
    readonly ms: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates an instrument from `options`. Throws if an option is not valid, such as a step that does not parse or a sweep to 0 Hz. */
export function createInstrument(options: InstrumentOptions): Instrument {
    const envelope = options.envelope ?? DEFAULT_ENVELOPE;
    const note = options.note === undefined ? DEFAULT_NOTE : parseNote(options.note, 'instrument note');
    const pulseWidth = options.pulseWidth ?? 0.5;
    const arpeggio = options.arpeggio ?? [];
    if (arpeggio.length > MAX_ARPEGGIO) {
        throw new Error(`instrument: an arpeggio has at most ${MAX_ARPEGGIO} notes; this one has ${arpeggio.length}`);
    }
    const sweep = options.filterSweep;
    if (sweep !== undefined && !(sweep.fromHz > 0 && sweep.toHz > 0)) {
        throw new Error(`instrument: a filter sweep's fromHz and toHz must be above 0; got ${sweep.fromHz} and ${sweep.toHz}`);
    }
    const data: InstrumentData = {
        wave: toWaveFlags(options.wave ?? 'pulse'),
        pulseWidth,
        wavetable: options.wavetable === undefined ? [] : parseWavetable(options.wavetable),
        attackMs: envelope.attackMs,
        decayMs: envelope.decayMs,
        sustain: envelope.sustain,
        releaseMs: envelope.releaseMs,
        volume: options.volume ?? 1,
        filter: toFilterRoute(options.filter),
        echo: options.echo ?? 0,
        note,
        stepMs: options.stepMs ?? DEFAULT_STEP_MS,
        steps: splitRows(options.steps ?? '').map((row, i) => parseStep(row, i)),
        arpeggio,
        vibratoSemitones: options.vibrato?.semitones ?? 0,
        vibratoHz: options.vibrato?.hz ?? 0,
        vibratoDelayMs: options.vibrato?.delayMs ?? 0,
        pulseSweepMs: options.pulseSweep?.ms ?? 0,
        pulseSweepTo: options.pulseSweep?.to ?? pulseWidth,
        isPulseSweepPingPong: options.pulseSweep?.isPingPong ?? false,
        filterSweepMs: sweep?.ms ?? 0,
        filterSweepFromHz: sweep?.fromHz ?? 0,
        filterSweepToHz: sweep?.toHz ?? 0,
        syncSource: options.syncSource ?? -1,
        ringSource: options.ringSource ?? -1,
    };
    return Object.freeze({ data, filter: options.filter, note });
}

/** The note number of a name such as `C-4`. If the name is not a note in range, throws an error that starts with `where`. */
export function parseNote(name: string, where: string): number {
    const note = toNoteNumber(name);
    if (note === undefined) throw new Error(`${where}: '${name}' is not a note (write C-4, F#5)`);
    if (!isNoteInRange(note)) throw new Error(`${where}: '${name}' is above ${HIGHEST_NOTE_NAME}, the highest note`);
    return note;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_ENVELOPE: Envelope = { attackMs: 2, decayMs: 0, sustain: 1, releaseMs: 60 };
const DEFAULT_NOTE = 60;

/**
 * Parses one row of a step table. Each token is a wave, a pitch, a volume
 * (`v`), a pulse width (`p`) or a cutoff (`f`). Each kind may appear at most
 * once.
 */
function parseStep(row: string, index: number): StepData {
    const where = `step ${index}`;
    let wave = -1;
    let pitchMode: StepData['pitchMode'] = 'none';
    let pitch = 0;
    let volume = -1;
    let pulseWidth = -1;
    let cutoffHz = -1;
    for (const token of splitTokens(row)) {
        const asWave = parseWaveToken(token);
        const asRelative = parseRelativePitch(token);
        const asNote = toNoteNumber(token);
        const asVolume = parseHexToken(token, 'v', 1);
        const asPulse = parseHexToken(token, 'p', 1);
        const asFilter = parseHexToken(token, 'f', 1);
        if (asWave !== undefined) {
            if (wave >= 0) throw new Error(`${where}: two waves`);
            wave = asWave;
        }
        else if (asRelative !== undefined || asNote !== undefined) {
            if (pitchMode !== 'none') throw new Error(`${where}: two pitches`);
            if (asNote !== undefined && !isNoteInRange(asNote)) {
                throw new Error(`${where}: '${token}' is above ${HIGHEST_NOTE_NAME}, the highest note`);
            }
            pitchMode = asNote !== undefined ? 'absolute' : 'relative';
            pitch = asNote ?? asRelative ?? 0;
        }
        else if (asVolume !== undefined) {
            if (volume >= 0) throw new Error(`${where}: two volumes`);
            volume = asVolume / 15;
        }
        else if (asPulse !== undefined) {
            if (pulseWidth >= 0) throw new Error(`${where}: two pulse widths`);
            pulseWidth = asPulse / 16;
        }
        else if (asFilter !== undefined) {
            if (cutoffHz >= 0) throw new Error(`${where}: two cutoffs`);
            cutoffHz = toCutoff(asFilter);
        }
        else {
            throw new Error(`${where}: '${token}' is not a wave, a pitch (+7, C-5), a volume (v0-vF), a pulse width (p0-pF) or a cutoff (f0-fF)`);
        }
    }
    return { wave, pitchMode, pitch, volume, pulseWidth, cutoffHz };
}

function parseWavetable(text: string): number[] {
    const digits = text.replace(/\s+/g, '');
    if (!/^[0-9A-Fa-f]*$/.test(digits) || digits.length !== WAVETABLE_SIZE) {
        throw new Error(`wavetable: needs ${WAVETABLE_SIZE} hex digits, one level (0-F) each; got '${text}'`);
    }
    const levels: number[] = [];
    for (let i = 0; i < digits.length; i++) levels.push(parseInt(digits[i], 16));
    return levels;
}
