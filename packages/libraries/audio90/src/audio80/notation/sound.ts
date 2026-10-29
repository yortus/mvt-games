import { DEFAULT_STEP_MS, MAX_ARPEGGIO, parseHexToken, parseNote, parseNoteToken, parseRelativePitch, splitRows, splitTokens } from '../../shared';
import {
    toCutoff,
    type Audio80FilterId,
    toFilterRoute,
    type SoundData,
    type StepData,
    type Audio80Wave,
    WAVETABLE_SIZE,
    toWaveFlags,
} from '../synthesiser';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A sound for the Audio80. It holds how a voice sounds as a note starts, and
 * what changes while the note plays: an arpeggio, vibrato, pulse and filter
 * sweeps, and a step table. It also holds how it plays on its own: its note,
 * how long it lasts, and its priority.
 *
 * Play it on its own with `Audio80.play`, as a game plays a laser or a coin.
 * A song plays it too, as one of its `instruments`. A song's patterns say
 * which note it plays and for how long, so a song ignores the sound's
 * `lengthMs`, `glideTo`, `priority` and `maxVoices`.
 */
export interface Audio80Sound {
    /** The chip it plays on. */
    readonly chip: 'audio80';
    /** What the chip is sent, such as the note it plays when played with no note, and the filter its notes go through. */
    readonly data: SoundData;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What `createAudio80Sound` makes a sound from. Every option has a default. */
export interface Audio80SoundOptions {
    /** The waveform. Defaults to `'pulse'`. */
    readonly wave?: Audio80Wave;
    /** The pulse's width, 0 to 1. Defaults to 0.5, a square wave. */
    readonly pulseWidth?: number;
    /** The `wavetable` wave's shape, as 32 hex digits. Each digit is a level from 0 to F. Spaces are ignored. */
    readonly wavetable?: string;
    /** Defaults to a near-instant attack, full sustain and a short release. */
    readonly envelope?: Audio80Envelope;
    /** The sound's volume, 0 or more. Defaults to 1. */
    readonly volume?: number;
    /** The filter, `a` or `b`, its notes go through. Defaults to none. */
    readonly filter?: Audio80FilterId;
    /** How much goes to the echo, 0 to 1. Defaults to 0. */
    readonly echo?: number;
    /** The note it plays when played with no note, or named in a song with no note, such as `C-4`. Defaults to `C-4`. */
    readonly note?: string;
    /** A note to glide to over `lengthMs` when played. Defaults to none. */
    readonly glideTo?: string;
    /**
     * How long it holds its note when played, before releasing it, in ms. It
     * must be above 0. Defaults to the length of the step table, or 250 ms if
     * there is none.
     */
    readonly lengthMs?: number;
    /** When played, it takes a voice from a sound already playing only if that sound's priority is no higher. Defaults to 0. */
    readonly priority?: number;
    /** How many voices it may play on at once. Played once more, it restarts its oldest voice. Defaults to 1. */
    readonly maxVoices?: number;
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
    readonly vibrato?: Audio80Vibrato;
    /** A pulse width that moves from `pulseWidth` while the note plays. Defaults to none. */
    readonly pulseSweep?: Audio80PulseSweep;
    /** A filter cutoff that moves while the note plays. Defaults to none. */
    readonly filterSweep?: Audio80FilterSweep;
    /** The voice whose cycle restarts this voice's cycle, if any. This is called hard sync. */
    readonly syncSource?: number;
    /** The voice whose phase flips this voice's triangle wave, if any. This is called ring modulation. */
    readonly ringSource?: number;
}

/** How a note's loudness rises, falls and dies away. */
export interface Audio80Envelope {
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
export interface Audio80Vibrato {
    /** The most it bends the pitch either way, in semitones. */
    readonly semitones: number;
    /** How many times a second it wobbles. */
    readonly hz: number;
    /** How long a note holds before its vibrato starts, in ms. Defaults to 0. */
    readonly delayMs?: number;
}

/** A pulse width that moves while a note plays. */
export interface Audio80PulseSweep {
    /** The width it sweeps to from `pulseWidth`, 0 to 1. */
    readonly to: number;
    /** How long one sweep takes, in ms. */
    readonly ms: number;
    /** Whether it sweeps back and forth, rather than once. */
    readonly isPingPong?: boolean;
}

/** A filter cutoff that moves while a note plays. */
export interface Audio80FilterSweep {
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

/**
 * Creates a sound from `options`. Throws if an option is not valid, such as
 * a step that does not parse, a sweep to 0 Hz or a length of 0 or less.
 */
export function createAudio80Sound(options: Audio80SoundOptions): Audio80Sound {
    const envelope = options.envelope ?? DEFAULT_ENVELOPE;
    const note = options.note === undefined ? DEFAULT_NOTE : parseNote(options.note, 'sound: note');
    const pulseWidth = options.pulseWidth ?? 0.5;
    const arpeggio = options.arpeggio ?? [];
    if (arpeggio.length > MAX_ARPEGGIO) {
        throw new Error(`sound: an arpeggio has at most ${MAX_ARPEGGIO} notes; this one has ${arpeggio.length}`);
    }
    const sweep = options.filterSweep;
    if (sweep !== undefined && !(sweep.fromHz > 0 && sweep.toHz > 0)) {
        throw new Error(`sound: a filter sweep's fromHz and toHz must be above 0; got ${sweep.fromHz} and ${sweep.toHz}`);
    }
    const stepMs = options.stepMs ?? DEFAULT_STEP_MS;
    const steps = splitRows(options.steps ?? '').map((row, i) => parseStep(row, i));
    const lengthMs = options.lengthMs ?? (steps.length > 0 ? steps.length * stepMs : DEFAULT_LENGTH_MS);
    if (!(lengthMs > 0)) throw new Error(`sound: lengthMs must be above 0; got ${lengthMs}`);
    const data: SoundData = {
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
        lengthMs,
        glideTo: options.glideTo === undefined ? Number.NaN : parseNote(options.glideTo, 'sound: glideTo'),
        priority: options.priority ?? 0,
        maxVoices: Math.max(1, options.maxVoices ?? 1),
        stepMs,
        steps,
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
    const sound: Audio80Sound = Object.freeze({ chip: 'audio80', data });
    SOUNDS.add(sound);
    return sound;
}

/** Whether `value` is a sound that `createAudio80Sound` made, such as one found among a module's exports. */
export function isAudio80Sound(value: unknown): value is Audio80Sound {
    return typeof value === 'object' && value !== null && SOUNDS.has(value);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_ENVELOPE: Audio80Envelope = { attackMs: 2, decayMs: 0, sustain: 1, releaseMs: 60 };
const DEFAULT_NOTE = 60;
const DEFAULT_LENGTH_MS = 250;

/** Every wave a step row may name. */
const WAVES: readonly Audio80Wave[] = [
    'triangle', 'saw', 'pulse', 'noise', 'wavetable', 'triangle+saw', 'triangle+pulse', 'saw+pulse', 'triangle+saw+pulse',
];

/** Every sound made, so `isAudio80Sound` knows one when it sees it. */
const SOUNDS = new WeakSet<object>();

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
        const asWave = (WAVES as readonly string[]).includes(token) ? toWaveFlags(token as Audio80Wave) : undefined;
        const asRelative = parseRelativePitch(token);
        const asNote = parseNoteToken(token, where);
        const asVolume = parseHexToken(token, 'v', 1);
        const asPulse = parseHexToken(token, 'p', 1);
        const asFilter = parseHexToken(token, 'f', 1);
        if (asWave !== undefined) {
            if (wave >= 0) throw new Error(`${where}: two waves`);
            wave = asWave;
        }
        else if (asRelative !== undefined || asNote !== undefined) {
            if (pitchMode !== 'none') throw new Error(`${where}: two pitches`);
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
