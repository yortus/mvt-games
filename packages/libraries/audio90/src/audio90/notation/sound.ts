import {
    DEFAULT_STEP_MS, HIGHEST_NOTE_NAME, isNoteInRange, MAX_ARPEGGIO, parseHexToken, parseRelativePitch, splitRows, splitTokens, type StepPitchMode,
    toNoteNumber,
} from '../../shared';
import {
    type Audio90EnvelopeData,
    type Audio90SoundData,
    type Audio90OperatorData,
    type Audio90StepData,
    DEFAULT_AUDIO90_SOUND,
    ENGINE_ANALOG,
    ENGINE_FM,
    ENGINE_SAMPLE,
    FILTER90_LOWPASS_24,
    FILTER90_NONE,
    LFO_SINE,
    MAX_OPERATORS,
    MAX_UNISON,
} from '../synthesiser';
import type { Audio90Sample } from './sample';
import {
    type Audio90Engine,
    type Audio90FilterMode,
    type Audio90LfoShape,
    type Audio90OperatorWave,
    type Audio90Wave,
    ENGINE_INDEX,
    ENGINE_NAMES,
    FILTER90_MODE_INDEX,
    LFO_SHAPE_INDEX,
    lookUpName,
    OPERATOR_WAVE_INDEX,
    toPan,
    WAVE90_INDEX,
} from './tokens';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A sound for the Audio90. It holds a voice's engine and its settings, and
 * what changes while a note plays: its envelopes, its LFO, an arpeggio,
 * vibrato and a step table. It also holds how it plays on its own: its note,
 * how long it lasts, and its priority.
 *
 * Play it on its own with `Audio90.play`, as a game plays a laser or a coin.
 * A song plays it too, as one of its `instruments`. A song's patterns say
 * which note it plays and for how long, so a song ignores the sound's
 * `lengthMs`, `glideTo`, `priority` and `maxVoices`.
 */
export interface Audio90Sound {
    /** The chip it plays on. */
    readonly chip: 'audio90';
    /** How it makes its sound: FM operators, analog oscillators, or a sample. */
    readonly engine: Audio90Engine;
    /** What the chip is sent. A sample sound's `sample` id is filled in by the chip when it sends the sample. */
    readonly data: Audio90SoundData;
    /** The sample a sample sound plays, or undefined for an FM or analog one. */
    readonly sample: Audio90Sample | undefined;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * What `createAudio90Sound` makes a sound from. Every option has a default.
 * The options under "FM", "Analog" and "Sample" are for that engine only, and
 * giving one to another engine is an error.
 */
export interface Audio90SoundOptions {
    /** How it makes its sound. Defaults to `'analog'`. */
    readonly engine?: Audio90Engine;
    /** The note it plays when played with no note, or named in a song with no note, such as `C-2` for a bass drum. Defaults to `C-4`. */
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
    /** Its volume, 0 or more. Defaults to 1. */
    readonly volume?: number;
    /** Where it sits, from -1 (left) to 1 (right). Defaults to 0, the centre. */
    readonly pan?: number;
    /** How much goes to the reverb, 0 to 1. Defaults to 0. */
    readonly reverb?: number;
    /** How much goes to the echo, 0 to 1. Defaults to 0. */
    readonly echo?: number;
    /** How much goes to the chorus, 0 to 1. Defaults to 0. */
    readonly chorus?: number;
    /** How the note's volume rises, falls and dies away. Defaults to a near-instant attack, full sustain and a short release. */
    readonly envelope?: Audio90Envelope;
    /** A second envelope, which moves the pitch, the cutoff or the brightness as the note plays. Defaults to none. */
    readonly modEnvelope?: Audio90ModEnvelope;
    /** A low-frequency oscillator, which wobbles the pitch, cutoff, brightness, volume or pan. Defaults to none. */
    readonly lfo?: Audio90Lfo;
    /** The voice's filter. Defaults to none. */
    readonly filter?: Audio90Filter;
    /** How long each step of `steps` and `arpeggio` lasts, in ms. Defaults to 1/60 s. */
    readonly stepMs?: number;
    /**
     * A step table, which changes the note's settings step by step. It is a
     * multiline string, with one step on each line, and the last step holds.
     * A `#` at the start of a line or after a space starts a comment. A step
     * may set any of these:
     *
     * - an analog wave, such as `pulse`
     * - a pitch: `+7` or `-12` from the note, or a note such as `C-5`
     * - a volume, `v0` to `vF`
     * - a pan, `P00` (left) to `PFF` (right), with `P80` the centre
     * - a brightness, `f0` to `fF`
     * - a sample's slice, `s00` to `sFF`
     */
    readonly steps?: string;
    /** Semitone offsets from the note, played one per step in a cycle, such as `[0, 4, 7]`. At most `MAX_ARPEGGIO`. */
    readonly arpeggio?: readonly number[];
    /** A wobble in pitch, at the driver's rate. Defaults to none. */
    readonly vibrato?: Audio90Vibrato;
    /** A glide into each note that follows another, in ms. Defaults to none. */
    readonly glideMs?: number;
    /**
     * Makes a note that overlaps the one before tie into it, as an acid bass
     * slides: it glides, over `glideMs`, and its envelopes run on rather than
     * starting again. Give `glideMs` here or above, not both.
     */
    readonly legato?: { readonly glideMs?: number };

    /** FM: which operators modulate which, such as `'2>1 4>3'`. Operators named in no chain are heard. Defaults to every operator heard. */
    readonly algorithm?: string;
    /** FM: one to four operators, operator 1 first. */
    readonly operators?: readonly Audio90Operator[];
    /** FM: how much the highest operator modulates itself, 0 to 1. Defaults to 0. */
    readonly feedback?: number;
    /** FM: how much faster high notes' operators fade, 0 to 1, as struck strings do. Defaults to 0. */
    readonly rateScaling?: number;

    /** Analog: the oscillator. Defaults to one saw. */
    readonly oscillator?: Audio90Oscillator;
    /** Analog: a second oscillator, a set interval from the first. Defaults to none. */
    readonly oscillatorB?: Audio90OscillatorB;
    /** Analog: the level of a square an octave below, 0 to 1. Defaults to 0. */
    readonly sub?: number;
    /** Analog: the level of white noise, 0 to 1. Defaults to 0. */
    readonly noise?: number;

    /** Sample: the sample it plays. */
    readonly sample?: Audio90Sample;
    /** Sample: the note the sample sounds at its own rate. Defaults to the sample's own. */
    readonly rootNote?: string;
    /** Sample: whether the sample plays backwards. Defaults to false. */
    readonly isReversed?: boolean;
}

/** How a sound's level rises, falls and dies away. */
export interface Audio90Envelope {
    /** How long it takes to rise from silence to its peak, in ms. */
    readonly attackMs: number;
    /** How long it takes to fall from its peak towards `sustain`, in ms. The gap between them falls 60 dB over this time. */
    readonly decayMs: number;
    /** The level it holds after its decay, from 0 to 1, until the note is released. A volume envelope that decays to 0 ends its note. */
    readonly sustain: number;
    /** How long it takes to fall 60 dB once the note is released, in ms. */
    readonly releaseMs: number;
}

/** A second envelope, sent to one of a note's settings. */
export interface Audio90ModEnvelope {
    /** What it moves. */
    readonly to: 'pitch' | 'cutoff' | 'brightness';
    /** How far it moves it at the envelope's peak: semitones for pitch, octaves for cutoff, 0 to 1 for brightness. Negative moves it down. */
    readonly amount: number;
    readonly envelope: Audio90Envelope;
}

/** A low-frequency oscillator, and how far it moves each setting. Each amount defaults to 0. */
export interface Audio90Lfo {
    /** Defaults to `'sine'`. */
    readonly shape?: Audio90LfoShape;
    /** Its rate in Hz. Give this or `rateBeats`. Defaults to 5 Hz. */
    readonly rateHz?: number;
    /** Its cycle in beats of the song's tempo, such as 1 / 4 for sixteenth notes at four rows a beat. */
    readonly rateBeats?: number;
    /** How long a note plays before the LFO moves it, in ms. Defaults to 0. */
    readonly delayMs?: number;
    /** Whether each note starts the LFO's cycle again. If not, it runs free. Defaults to true. */
    readonly isRetriggered?: boolean;
    /** Semitones each way. */
    readonly pitch?: number;
    /** Octaves each way. */
    readonly cutoff?: number;
    /** 0 to 1. */
    readonly brightness?: number;
    /** 0 to 1. The volume dips as the LFO falls, so a square LFO is a gate that is open on the beat. */
    readonly volume?: number;
    /** 0 to 1, each way. */
    readonly pan?: number;
}

/** A voice's filter. */
export interface Audio90Filter {
    /** Defaults to `'lowpass24'`. */
    readonly mode?: Audio90FilterMode;
    /** Its cutoff, in Hz, above 0. */
    readonly cutoffHz: number;
    /** 0 to 1. Near 1, a `lowpass24` filter rings at its cutoff. Defaults to 0. */
    readonly resonance?: number;
    /** How hard the filter's input is driven, 0 to 1. Defaults to 0. */
    readonly drive?: number;
    /** How much the cutoff follows the note's pitch, 0 to 1. Defaults to 0. */
    readonly keyTrack?: number;
    /** How much more an accented note (`!`) opens the filter and lifts the volume, 0 to 1. Defaults to 0. */
    readonly accent?: number;
    /**
     * A shorthand for a mod envelope sent to the cutoff: how many octaves it
     * opens the filter, and the envelope's times. They default to an instant
     * attack, a sustain of 0 and no release. Give this or `modEnvelope`, not both.
     */
    readonly envelope?: { readonly octaves: number } & Partial<Audio90Envelope>;
}

/** A wobble in pitch. */
export interface Audio90Vibrato {
    /** The most it bends the pitch either way, in semitones. */
    readonly semitones: number;
    /** How many times a second it wobbles. */
    readonly hz: number;
    /** How long a note holds before its vibrato starts, in ms. Defaults to 0. */
    readonly delayMs?: number;
}

/** One FM operator: a sine, or a shape cut from one, whose output is heard or modulates another's. */
export interface Audio90Operator {
    /** Its frequency as a multiple of the note's, a multiple of 0.5 from 0.5 to 32. Defaults to 1. */
    readonly ratio?: number;
    /** A fixed frequency in Hz in place of `ratio`, for sounds that do not follow the note, such as a drum's crack. */
    readonly fixedHz?: number;
    /** A small detune from `ratio`, in cents. Defaults to 0. */
    readonly detuneCents?: number;
    /** Its level, 0 or more. A modulator's level sets how bright the sound is. Defaults to 1. */
    readonly level?: number;
    /** Defaults to `'sine'`. */
    readonly wave?: Audio90OperatorWave;
    /** How much a softer note lowers its level, 0 to 1. Defaults to 0. */
    readonly velocity?: number;
    /** Its own envelope. Defaults to holding its level, with the sound's release. */
    readonly envelope?: Audio90Envelope;
}

/** An analog voice's oscillator, and its copies. */
export interface Audio90Oscillator {
    /** Defaults to `'saw'`. */
    readonly wave?: Audio90Wave;
    /** How many copies play at once, from 0 (for only the sub and noise) to `MAX_UNISON`. Defaults to 1. */
    readonly unison?: number;
    /** How far apart the copies are tuned, 0 to 1. Defaults to 0. */
    readonly detune?: number;
    /** How far apart the copies are spread across the stereo field, 0 to 1. Defaults to 0. */
    readonly spread?: number;
    /** A pulse wave's width, 0 to 1. Defaults to 0.5, a square. */
    readonly pulseWidth?: number;
    /** Semitone offsets the copies play at once, as chord memory, such as `[0, 4, 7]`. Defaults to none. */
    readonly chord?: readonly number[];
}

/** An analog voice's second oscillator. */
export interface Audio90OscillatorB {
    /** Its interval from the first oscillator, in semitones. */
    readonly interval: number;
    /** Its level, 0 to 1. Defaults to 1. */
    readonly level?: number;
    /** Whether it restarts each time the first oscillator's cycle does: hard sync. Defaults to false. */
    readonly isSynced?: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Audio90 sound from `options`. Throws if an option is not valid,
 * with the option's path, such as `operators[3].ratio: 0.3 is not a multiple
 * of 0.5`.
 */
export function createAudio90Sound(options: Audio90SoundOptions): Audio90Sound {
    const engine = lookUpName(ENGINE_INDEX, options.engine ?? 'analog', 'sound: engine');
    checkEngineOptions(options, engine);
    const envelope = checkEnvelope(options.envelope ?? DEFAULT_ENVELOPE, 'envelope');
    const arpeggio = options.arpeggio ?? [];
    if (arpeggio.length > MAX_ARPEGGIO) {
        throw new Error(`sound: an arpeggio has at most ${MAX_ARPEGGIO} notes; this one has ${arpeggio.length}`);
    }
    if (options.glideMs !== undefined && options.legato?.glideMs !== undefined) {
        throw new Error('sound: give glideMs or legato.glideMs, not both');
    }
    const sample = options.sample;
    if (engine === ENGINE_SAMPLE && sample === undefined) throw new Error('sound: a sample sound needs a sample');
    const stepMs = options.stepMs ?? DEFAULT_STEP_MS;
    const steps = Object.freeze(splitRows(options.steps ?? '').map((row, i) => parseStep(row, i)));
    const lengthMs = options.lengthMs ?? (steps.length > 0 ? steps.length * stepMs : DEFAULT_LENGTH_MS);
    if (!(lengthMs > 0)) throw new Error(`sound: lengthMs must be above 0; got ${lengthMs}`);

    const data: Audio90SoundData = {
        ...DEFAULT_AUDIO90_SOUND,
        engine,
        note: options.note === undefined ? DEFAULT_NOTE : parseNote(options.note, 'sound: note'),
        lengthMs,
        glideTo: options.glideTo === undefined ? Number.NaN : parseNote(options.glideTo, 'sound: glideTo'),
        priority: options.priority ?? 0,
        maxVoices: Math.max(1, options.maxVoices ?? 1),
        volume: checkRange(options.volume ?? 1, 0, Infinity, 'volume'),
        pan: checkRange(options.pan ?? 0, -1, 1, 'pan'),
        reverb: checkRange(options.reverb ?? 0, 0, 1, 'reverb'),
        echo: checkRange(options.echo ?? 0, 0, 1, 'echo'),
        chorus: checkRange(options.chorus ?? 0, 0, 1, 'chorus'),
        envelope,
        ...buildModEnvelope(options),
        ...buildLfo(options.lfo),
        ...buildFilter(options.filter),
        stepMs,
        steps,
        arpeggio: Object.freeze([...arpeggio]),
        vibratoSemitones: options.vibrato?.semitones ?? 0,
        vibratoHz: options.vibrato?.hz ?? 0,
        vibratoDelayMs: options.vibrato?.delayMs ?? 0,
        glideMs: checkRange(options.glideMs ?? options.legato?.glideMs ?? 0, 0, Infinity, 'glideMs'),
        isLegato: options.legato !== undefined,
        ...(engine === ENGINE_FM ? buildFm(options, envelope) : {}),
        ...(engine === ENGINE_ANALOG ? buildAnalog(options) : {}),
        ...(engine === ENGINE_SAMPLE ? buildSample(options) : {}),
    };
    const sound: Audio90Sound = Object.freeze({ chip: 'audio90', engine: ENGINE_NAMES[engine], data: Object.freeze(data), sample: engine === ENGINE_SAMPLE ? sample : undefined });
    SOUNDS.add(sound);
    return sound;
}

/** Whether `value` is a sound that `createAudio90Sound` made, such as one found among a module's exports. */
export function isAudio90Sound(value: unknown): value is Audio90Sound {
    return typeof value === 'object' && value !== null && SOUNDS.has(value);
}

/** The note number of a name such as `C-4`. If the name is not a note in range, throws an error that starts with `where`. */
export function parseNote(name: string, where: string): number {
    const note = toNoteNumber(name);
    if (note === undefined) throw new Error(`${where}: '${name}' is not a note (write C-4, F#5)`);
    if (!isNoteInRange(note)) throw new Error(`${where}: '${name}' is above ${HIGHEST_NOTE_NAME}, the highest note`);
    return note;
}

/** Returns `value` if it is a number from `min` to `max`, or throws an error that names the option at `path`. */
export function checkRange(value: number, min: number, max: number, path: string, prefix = 'sound'): number {
    if (!(value >= min && value <= max)) {
        const range = max === Infinity ? `${min} or more` : `${min} to ${max}`;
        throw new Error(`${prefix}: ${path}: ${value} is not ${range}`);
    }
    return value;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_ENVELOPE: Audio90Envelope = { attackMs: 2, decayMs: 0, sustain: 1, releaseMs: 60 };
const DEFAULT_NOTE = 60;
const DEFAULT_LENGTH_MS = 250;

/** Every sound made, so `isAudio90Sound` knows one when it sees it. */
const SOUNDS = new WeakSet<object>();

/** An operator's ratio is a multiple of this. */
const RATIO_STEP = 0.5;
const MAX_RATIO = 32;

/** Each engine's own options, to check that a sound gives only its engine's. */
const ENGINE_OPTIONS: Readonly<Record<number, readonly (keyof Audio90SoundOptions)[]>> = {
    [ENGINE_FM]: ['algorithm', 'operators', 'feedback', 'rateScaling'],
    [ENGINE_ANALOG]: ['oscillator', 'oscillatorB', 'sub', 'noise'],
    [ENGINE_SAMPLE]: ['sample', 'rootNote', 'isReversed'],
};

/** Throws if `options` gives an option that belongs to an engine other than `engine`. */
function checkEngineOptions(options: Audio90SoundOptions, engine: number): void {
    for (const other of [ENGINE_FM, ENGINE_ANALOG, ENGINE_SAMPLE]) {
        if (other === engine) continue;
        for (const key of ENGINE_OPTIONS[other]) {
            if (options[key] !== undefined) {
                throw new Error(`sound: ${key} is only for ${ENGINE_NAMES[other]} sounds, and this one is ${ENGINE_NAMES[engine]}`);
            }
        }
    }
}

function checkEnvelope(envelope: Audio90Envelope, path: string): Audio90EnvelopeData {
    return Object.freeze({
        attackMs: checkRange(envelope.attackMs, 0, Infinity, `${path}.attackMs`),
        decayMs: checkRange(envelope.decayMs, 0, Infinity, `${path}.decayMs`),
        sustain: checkRange(envelope.sustain, 0, 1, `${path}.sustain`),
        releaseMs: checkRange(envelope.releaseMs, 0, Infinity, `${path}.releaseMs`),
    });
}

/** The mod envelope's fields, from `modEnvelope` or from the filter's envelope shorthand. */
function buildModEnvelope(options: Audio90SoundOptions): Partial<Audio90SoundData> {
    const mod = options.modEnvelope;
    const shorthand = options.filter?.envelope;
    if (mod !== undefined && shorthand !== undefined) throw new Error('sound: give filter.envelope or modEnvelope, not both');
    if (shorthand !== undefined) {
        const envelope = checkEnvelope({
            attackMs: shorthand.attackMs ?? 0,
            decayMs: shorthand.decayMs ?? 0,
            sustain: shorthand.sustain ?? 0,
            releaseMs: shorthand.releaseMs ?? 0,
        }, 'filter.envelope');
        return { modEnvelope: envelope, modCutoff: checkFinite(shorthand.octaves, 'filter.envelope.octaves') };
    }
    if (mod === undefined) return {};
    const envelope = checkEnvelope(mod.envelope, 'modEnvelope.envelope');
    const amount = checkFinite(mod.amount, 'modEnvelope.amount');
    switch (mod.to) {
        case 'pitch':
            return { modEnvelope: envelope, modPitch: amount };
        case 'cutoff':
            return { modEnvelope: envelope, modCutoff: amount };
        case 'brightness':
            return { modEnvelope: envelope, modBrightness: amount };
        default:
            throw new Error(`sound: modEnvelope.to: '${String(mod.to)}' is not one of pitch, cutoff, brightness`);
    }
}

function buildLfo(lfo: Audio90Lfo | undefined): Partial<Audio90SoundData> {
    if (lfo === undefined) return {};
    if (lfo.rateHz !== undefined && lfo.rateBeats !== undefined) throw new Error('sound: give lfo.rateHz or lfo.rateBeats, not both');
    return {
        lfoShape: lfo.shape === undefined ? LFO_SINE : lookUpName(LFO_SHAPE_INDEX, lfo.shape, 'sound: lfo.shape'),
        lfoHz: checkRange(lfo.rateHz ?? DEFAULT_AUDIO90_SOUND.lfoHz, 0, Infinity, 'lfo.rateHz'),
        lfoBeats: lfo.rateBeats === undefined ? 0 : checkRange(lfo.rateBeats, Number.MIN_VALUE, Infinity, 'lfo.rateBeats'),
        lfoDelayMs: checkRange(lfo.delayMs ?? 0, 0, Infinity, 'lfo.delayMs'),
        isLfoRetriggered: lfo.isRetriggered ?? true,
        lfoPitch: checkFinite(lfo.pitch ?? 0, 'lfo.pitch'),
        lfoCutoff: checkFinite(lfo.cutoff ?? 0, 'lfo.cutoff'),
        lfoBrightness: checkRange(lfo.brightness ?? 0, 0, 1, 'lfo.brightness'),
        lfoVolume: checkRange(lfo.volume ?? 0, 0, 1, 'lfo.volume'),
        lfoPan: checkRange(lfo.pan ?? 0, 0, 1, 'lfo.pan'),
    };
}

function buildFilter(filter: Audio90Filter | undefined): Partial<Audio90SoundData> {
    if (filter === undefined) return { filterMode: FILTER90_NONE };
    return {
        filterMode: filter.mode === undefined ? FILTER90_LOWPASS_24 : lookUpName(FILTER90_MODE_INDEX, filter.mode, 'sound: filter.mode'),
        cutoffHz: checkRange(filter.cutoffHz, Number.MIN_VALUE, Infinity, 'filter.cutoffHz'),
        resonance: checkRange(filter.resonance ?? 0, 0, 1, 'filter.resonance'),
        drive: checkRange(filter.drive ?? 0, 0, 1, 'filter.drive'),
        keyTrack: checkRange(filter.keyTrack ?? 0, 0, 1, 'filter.keyTrack'),
        accent: checkRange(filter.accent ?? 0, 0, 1, 'filter.accent'),
    };
}

function buildFm(options: Audio90SoundOptions, envelope: Audio90EnvelopeData): Partial<Audio90SoundData> {
    const given = options.operators ?? [];
    if (given.length === 0 || given.length > MAX_OPERATORS) {
        throw new Error(`sound: operators: an FM sound has 1 to ${MAX_OPERATORS} operators; this one has ${given.length}`);
    }
    // An operator's own envelope defaults to holding its level, and releasing as the note does
    const held: Audio90Envelope = { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: envelope.releaseMs };
    const operators = given.map((op, i): Audio90OperatorData => {
        const path = `operators[${i}]`;
        const ratio = op.ratio ?? 1;
        if (!(ratio >= RATIO_STEP && ratio <= MAX_RATIO && ratio % RATIO_STEP === 0)) {
            throw new Error(`sound: ${path}.ratio: ${ratio} is not a multiple of ${RATIO_STEP} from ${RATIO_STEP} to ${MAX_RATIO}`);
        }
        return Object.freeze({
            ratio,
            fixedHz: op.fixedHz === undefined ? 0 : checkRange(op.fixedHz, Number.MIN_VALUE, Infinity, `${path}.fixedHz`),
            detuneCents: checkFinite(op.detuneCents ?? 0, `${path}.detuneCents`),
            level: checkRange(op.level ?? 1, 0, Infinity, `${path}.level`),
            wave: op.wave === undefined ? OPERATOR_WAVE_INDEX.sine : lookUpName(OPERATOR_WAVE_INDEX, op.wave, `sound: ${path}.wave`),
            velocity: checkRange(op.velocity ?? 0, 0, 1, `${path}.velocity`),
            envelope: checkEnvelope(op.envelope ?? held, `${path}.envelope`),
        });
    });
    return {
        algorithm: Object.freeze(parseAlgorithm(options.algorithm ?? '', operators.length)),
        operators: Object.freeze(operators),
        feedback: checkRange(options.feedback ?? 0, 0, 1, 'feedback'),
        rateScaling: checkRange(options.rateScaling ?? 0, 0, 1, 'rateScaling'),
    };
}

/**
 * Parses an algorithm such as `'2>1 4>3'` or `'3+2>1'` into a mask for each
 * operator: bit j is set when operator j modulates it. Each chain names
 * operators from 1, and `+` groups operators that modulate together. An
 * operator can modulate only a lower-numbered one.
 */
function parseAlgorithm(text: string, count: number): number[] {
    const masks = new Array<number>(MAX_OPERATORS).fill(0);
    const where = `sound: algorithm '${text}'`;
    for (const chain of splitTokens(text)) {
        const groups = chain.split('>').map((group) => group.split('+').map((name) => {
            const number = Number(name);
            if (!(Number.isInteger(number) && number >= 1 && number <= count)) {
                throw new Error(`${where}: '${name}' is not one of its ${count} operators (1 to ${count})`);
            }
            return number - 1;
        }));
        if (groups.length < 2) throw new Error(`${where}: '${chain}' is not a chain, such as 2>1`);
        for (let g = 0; g + 1 < groups.length; g++) {
            for (const modulator of groups[g]) {
                for (const carrier of groups[g + 1]) {
                    if (modulator <= carrier) {
                        throw new Error(`${where}: operator ${modulator + 1} cannot modulate operator ${carrier + 1}; an operator modulates only lower-numbered ones`);
                    }
                    masks[carrier] |= 1 << modulator;
                }
            }
        }
    }
    return masks;
}

function buildAnalog(options: Audio90SoundOptions): Partial<Audio90SoundData> {
    const osc = options.oscillator ?? {};
    const chord = osc.chord ?? [];
    if (chord.length > MAX_UNISON) throw new Error(`sound: oscillator.chord: a chord has at most ${MAX_UNISON} notes; this one has ${chord.length}`);
    const unison = osc.unison ?? 1;
    if (!(Number.isInteger(unison) && unison >= 0 && unison <= MAX_UNISON)) {
        throw new Error(`sound: oscillator.unison: ${unison} is not a whole number from 0 to ${MAX_UNISON}`);
    }
    const b = options.oscillatorB;
    return {
        wave: lookUpName(WAVE90_INDEX, osc.wave ?? 'saw', 'sound: oscillator.wave'),
        unison,
        detune: checkRange(osc.detune ?? 0, 0, 1, 'oscillator.detune'),
        spread: checkRange(osc.spread ?? 0, 0, 1, 'oscillator.spread'),
        pulseWidth: checkRange(osc.pulseWidth ?? 0.5, 0, 1, 'oscillator.pulseWidth'),
        chord: Object.freeze([...chord]),
        intervalB: b === undefined ? 0 : checkFinite(b.interval, 'oscillatorB.interval'),
        levelB: b === undefined ? 0 : checkRange(b.level ?? 1, 0, 1, 'oscillatorB.level'),
        isSyncedB: b?.isSynced ?? false,
        sub: checkRange(options.sub ?? 0, 0, 1, 'sub'),
        noise: checkRange(options.noise ?? 0, 0, 1, 'noise'),
    };
}

function buildSample(options: Audio90SoundOptions): Partial<Audio90SoundData> {
    return {
        // The chip fills in the sample's id when it sends the sample
        sample: -1,
        rootNote: options.rootNote === undefined ? Number.NaN : parseNote(options.rootNote, 'sound: rootNote'),
        isReversed: options.isReversed ?? false,
    };
}

function checkFinite(value: number, path: string): number {
    if (!Number.isFinite(value)) throw new Error(`sound: ${path}: ${value} is not a number`);
    return value;
}

/**
 * Parses one row of a step table. Each token is a wave, a pitch, a volume
 * (`v`), a pan (`P`), a brightness (`f`) or a slice (`s`). Each kind may
 * appear at most once.
 */
function parseStep(row: string, index: number): Audio90StepData {
    const where = `sound: step ${index}`;
    let wave = -1;
    let pitchMode: StepPitchMode = 'none';
    let pitch = 0;
    let volume = -1;
    let pan = Number.NaN;
    let brightness = -1;
    let slice = -1;
    for (const token of splitTokens(row)) {
        const asRelative = parseRelativePitch(token);
        const asNote = toNoteNumber(token);
        const asVolume = parseHexToken(token, 'v', 1);
        const asPan = parseHexToken(token, 'P', 2);
        const asBrightness = parseHexToken(token, 'f', 1);
        const asSlice = parseHexToken(token, 's', 2);
        if (Object.hasOwn(WAVE90_INDEX, token)) {
            if (wave >= 0) throw new Error(`${where}: two waves`);
            wave = WAVE90_INDEX[token as Audio90Wave];
        }
        else if (asRelative !== undefined || asNote !== undefined) {
            if (pitchMode !== 'none') throw new Error(`${where}: two pitches`);
            if (asNote !== undefined && !isNoteInRange(asNote)) throw new Error(`${where}: '${token}' is above ${HIGHEST_NOTE_NAME}, the highest note`);
            pitchMode = asNote !== undefined ? 'absolute' : 'relative';
            pitch = asNote ?? asRelative ?? 0;
        }
        else if (asVolume !== undefined) {
            if (volume >= 0) throw new Error(`${where}: two volumes`);
            volume = asVolume / 15;
        }
        else if (asPan !== undefined) {
            if (!Number.isNaN(pan)) throw new Error(`${where}: two pans`);
            pan = toPan(asPan);
        }
        else if (asBrightness !== undefined) {
            if (brightness >= 0) throw new Error(`${where}: two brightnesses`);
            brightness = asBrightness / 15;
        }
        else if (asSlice !== undefined) {
            if (slice >= 0) throw new Error(`${where}: two slices`);
            slice = asSlice;
        }
        else {
            throw new Error(`${where}: '${token}' is not a wave, a pitch (+7, C-5), a volume (v0-vF), a pan (P00-PFF), a brightness (f0-fF) or a slice (s00-sFF)`);
        }
    }
    return Object.freeze({ pitchMode, pitch, volume, pan, brightness, slice, wave });
}
