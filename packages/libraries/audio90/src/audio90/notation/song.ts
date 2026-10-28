import {
    computeSongDurationMs,
    checkInstrumentLetters,
    checkLoop,
    checkTempo,
    HIGHEST_NOTE,
    HIGHEST_NOTE_NAME,
    isNoteInRange,
    LOWEST_NOTE,
    parseHexToken,
    parseOrder,
    type SongOrderEntry,
    splitCells,
    splitRows,
    splitTokens,
    toNoteNumber,
} from '../../shared';
import { type Audio90Character, AUDIO90_CHARACTERS, AUDIO90_EFFECT_DEFAULTS, AUDIO90_VOICE_COUNT, ENGINE_ANALOG, ENGINE_SAMPLE } from '../synthesiser';
import { type Audio90Sound, checkRange } from './sound';
import { ENGINE_NAMES } from './tokens';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A song for the Audio90, ready to play. `createAudio90Song` makes it from
 * patterns written as text. A pattern is a grid of cells, with one row per
 * time step and one cell per channel in each row. Each cell is stored as
 * numbers, so a player can read them with plain index loops. Channel n plays
 * on voice n.
 */
export interface Audio90Song {
    /** The chip it plays on. */
    readonly chip: 'audio90';
    /** Beats per minute, above 0. */
    readonly bpm: number;
    /** How many rows make a beat, as a whole number, 1 or more. */
    readonly rowsPerBeat: number;
    /** How late each odd-numbered row of a pattern plays, as a share of a row, from 0 to 0.5. */
    readonly swing: number;
    /** How many cells each row has, one per channel, up to 16. */
    readonly channelCount: number;
    /** The song's instruments, in the order that a cell's `CELL90_INSTRUMENT` indexes them. */
    readonly instruments: readonly Audio90Sound[];
    /** Each instrument's letter, as the patterns name it, in the order of `instruments`. */
    readonly instrumentLetters: readonly string[];
    /** The song's patterns, in the order that `SongOrderEntry.pattern` indexes them. */
    readonly patterns: readonly Audio90SongPattern[];
    /** The patterns in playing order. */
    readonly order: readonly SongOrderEntry[];
    /** The index in `order` to go back to at the end, or -1 to play once. */
    readonly loop: number;
    /**
     * How long one pass through `order` lasts, in ms, at the song's own tempo.
     * A song that loops goes on past it, from `loop`. Swing does not change it.
     */
    readonly durationMs: number;
    /** A gain on every note. At 1, the notes play as written. */
    readonly volume: number;
    /** Each channel's pan and sends as the song starts, one for every channel. */
    readonly mixer: readonly Required<Audio90ChannelMix>[];
    /** The reverb as the song starts, every setting given, or undefined to leave it as it is. */
    readonly reverb: Required<Audio90ReverbSettings> | undefined;
    /** The echo as the song starts, or undefined to leave it as it is. `timeBeats` is 0 when it is timed in ms. */
    readonly echo: Audio90SongEcho | undefined;
    /** The chorus as the song starts, or undefined to leave it as it is. */
    readonly chorus: Required<Audio90ChorusSettings> | undefined;
    /** The pump, or undefined for none. */
    readonly pump: Required<Audio90PumpSettings> | undefined;
    /** How the chip sounds while the song plays, or undefined to leave it as it is. */
    readonly character: Audio90Character | undefined;
}

/** One pattern of an Audio90 song: rows of cells, one cell per channel. */
export interface Audio90SongPattern {
    /** Its name in `Audio90SongOptions.patterns`. */
    readonly name: string;
    /** How many rows it has, 1 or more. */
    readonly rowCount: number;
    /** The cells, `CELL90_STRIDE` numbers each. They run row by row, and within a row, channel by channel. */
    readonly cells: Float64Array;
}

/** The echo as a song sets it, with every setting given. */
export interface Audio90SongEcho {
    readonly timeMs: number;
    /** The echo's time in beats, or 0 when it is timed by `timeMs`. */
    readonly timeBeats: number;
    readonly feedback: number;
    readonly toneHz: number;
    readonly isPingPong: boolean;
    readonly level: number;
}

/** How many numbers each cell takes in `Audio90SongPattern.cells`. The other `CELL90_*` constants are offsets within a cell. */
export const CELL90_STRIDE = 16;
/** A note number, or `NO_NOTE90` or `RELEASE90`. */
export const CELL90_NOTE = 0;
/** 1 if the note is the instrument's own, which transposition leaves alone. */
export const CELL90_IS_OWN_NOTE = 1;
/** An index into `instruments`, or -1. */
export const CELL90_INSTRUMENT = 2;
/** The note's volume, 0 to 15, or -1. */
export const CELL90_VOLUME = 3;
/** Two semitone offsets packed as `x * 16 + y`, or -1. */
export const CELL90_ARPEGGIO = 4;
/** The vibrato's depth in eighths of a semitone and rate in Hz, packed as `depth * 16 + rate`, or -1. */
export const CELL90_VIBRATO = 5;
/** 1 to glide from the last note, or 0. */
export const CELL90_GLIDE = 6;
/** Semitones to slide by over the row, or 0. */
export const CELL90_SLIDE = 7;
/** A pulse width in sixteenths, or -1. */
export const CELL90_PULSE = 8;
/** A brightness, 0 to 15, or -1. */
export const CELL90_BRIGHTNESS = 9;
/** A pan, 0 (left) to 255 (right), with 128 the centre, or -1. */
export const CELL90_PAN = 10;
/** A chord's two offsets packed as `x * 16 + y`, or -1. */
export const CELL90_CHORD = 11;
/** A sample's slice, from 0, or -1. */
export const CELL90_SLICE = 12;
/** A reverb send, 0 to 15, or -1. */
export const CELL90_REVERB = 13;
/** An echo send, 0 to 15, or -1. */
export const CELL90_ECHO = 14;
/** 1 to accent the note, or 0. */
export const CELL90_ACCENT = 15;

/** A `CELL90_NOTE` for a cell with no note. The channel's note plays on. */
export const NO_NOTE90 = -1;
/** A `CELL90_NOTE` for a release, written `===`. The channel's note fades out. */
export const RELEASE90 = -2;

/** The vibrato a bare `~` plays, packed as `CELL90_VIBRATO` packs it. It is a quarter of a semitone, six times a second. */
export const DEFAULT_VIBRATO90 = 2 * 16 + 6;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What `createAudio90Song` makes a song from. */
export interface Audio90SongOptions {
    /** Beats per minute, above 0. */
    readonly bpm: number;
    /** How many rows make a beat, as a whole number, 1 or more. Defaults to 4, which makes a row a sixteenth note. */
    readonly rowsPerBeat?: number;
    /** How late each odd-numbered row of a pattern plays, as a share of a row, from 0 to 0.5. Defaults to 0. */
    readonly swing?: number;
    /** The song's instruments, each named by the one letter the patterns use for it. */
    readonly instruments: Readonly<Record<string, Audio90Sound>>;
    /**
     * The song's patterns, by name, written as the Audio80's are: one row a
     * line, each cell starting with `|`, and `#` starting a comment. A cell
     * is tokens separated by spaces, each at most once:
     *
     * - a note such as `C-4`, `...` or nothing for no note, or `===` to release
     * - an instrument's letter
     * - the Audio80's effects: `v9`, `a37`, `~`, `~46`, `>`, `u0C`, `d0C` and `p8`
     * - `f0` to `fF`, the brightness, which lasts until the next `f`
     * - `P00` to `PFF`, the pan, with `P80` the centre, which lasts until the next `P`
     * - `r0` to `rF` and `e0` to `eF`, the reverb and echo sends, which last too
     * - `c47`, a chord on an analog instrument: the note, x semitones up and y up
     * - `s00` to `sFF`, a slice of a sample instrument
     * - `!`, an accent on an analog instrument
     */
    readonly patterns: Readonly<Record<string, string>>;
    /** Pattern names in playing order. Each may add a transposition in semitones, as in `'verse+5'`. */
    readonly order: readonly string[];
    /** The index in `order` to go back to at the end. Without it, the song plays once. */
    readonly loop?: number;
    /** A gain on every note, above 0. Defaults to 1. */
    readonly volume?: number;
    /** Each channel's pan and sends as the song starts. A channel with no entry is centred, with no sends. */
    readonly mixer?: readonly Audio90ChannelMix[];
    /** The reverb, set as the song starts. A setting left out takes the chip's default. Defaults to leaving the reverb as it is. */
    readonly reverb?: Audio90ReverbSettings;
    /** The echo, set as the song starts, as for `reverb`. */
    readonly echo?: Audio90EchoSettings;
    /** The chorus, set as the song starts, as for `reverb`. */
    readonly chorus?: Audio90ChorusSettings;
    /** The pump, which ducks the other channels on each note of one. Defaults to none. */
    readonly pump?: Audio90PumpSettings;
    /** How the chip sounds while the song plays. Defaults to leaving it as it is. */
    readonly character?: Audio90Character;
}

/** One channel's place in the mix as a song starts. Each defaults to 0. */
export interface Audio90ChannelMix {
    /** -1 (left) to 1 (right). */
    readonly pan?: number;
    /** The reverb send, 0 to 1. */
    readonly reverb?: number;
    /** The echo send, 0 to 1. */
    readonly echo?: number;
    /** The chorus send, 0 to 1. */
    readonly chorus?: number;
}

/** The reverb's settings. */
export interface Audio90ReverbSettings {
    /** How big the room is, 0 to 1. */
    readonly size?: number;
    /** How long the room rings, in ms. */
    readonly decayMs?: number;
    /** How fast the highs fade, 0 to 1. */
    readonly damping?: number;
    /** How loud it is, 0 to 1. */
    readonly level?: number;
}

/** The echo's settings. */
export interface Audio90EchoSettings {
    /** How long after a sound its echo comes, in ms. Give this or `timeBeats`. */
    readonly timeMs?: number;
    /** How long after a sound its echo comes, in beats of the song, such as 3 / 4 for a dotted eighth. */
    readonly timeBeats?: number;
    /** How much of each repeat feeds into the next, 0 to 0.95. */
    readonly feedback?: number;
    /** A low-pass filter on each repeat, in Hz, which darkens each one, as tape did. */
    readonly toneHz?: number;
    /** Whether the repeats alternate left and right. */
    readonly isPingPong?: boolean;
    /** How loud it is, 0 to 1. */
    readonly level?: number;
}

/** The chorus's settings. */
export interface Audio90ChorusSettings {
    /** How far its delays move, 0 to 1. */
    readonly depth?: number;
    /** How fast they move, in Hz. */
    readonly rateHz?: number;
    /** How loud it is, 0 to 1. */
    readonly level?: number;
}

/** The pump: each note of `channel` ducks the other channels, which come back over `releaseMs`. */
export interface Audio90PumpSettings {
    /** The channel whose notes duck the rest, usually the bass drum's. */
    readonly channel: number;
    /** How far the rest duck, 0 to 1. Defaults to 0.5. */
    readonly depth?: number;
    /** How long they take to come back, in ms. Defaults to 200. */
    readonly releaseMs?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Audio90 song from patterns written as text. If anything is not
 * valid, it throws an error that says where, such as `song: pattern 'drop',
 * row 3, channel 0: c37 needs an analog instrument, and 'S' is fm`.
 */
export function createAudio90Song(options: Audio90SongOptions): Audio90Song {
    const { bpm } = options;
    const { rowsPerBeat, swing } = checkTempo(options);

    const letters = Object.keys(options.instruments);
    checkInstrumentLetters(letters);
    const instruments = letters.map((letter) => options.instruments[letter]);
    const context: SongContext = { letters, instruments };

    let channelCount = 0;
    const patternNames = Object.keys(options.patterns);
    if (patternNames.length === 0) throw new Error('song: no patterns');
    const patterns = patternNames.map((name): Audio90SongPattern => {
        const rows = splitRows(options.patterns[name]);
        if (rows.length === 0) throw new Error(`song: pattern '${name}' has no rows`);
        const cells: number[] = [];
        for (let row = 0; row < rows.length; row++) {
            const texts = splitCells(rows[row], `song: pattern '${name}', row ${row}`);
            if (channelCount === 0) channelCount = texts.length;
            if (texts.length !== channelCount) {
                throw new Error(`song: pattern '${name}', row ${row}: expected ${channelCount} cells (one per channel), found ${texts.length}`);
            }
            for (let channel = 0; channel < texts.length; channel++) {
                parseCell(texts[channel], `song: pattern '${name}', row ${row}, channel ${channel}`, context, cells);
            }
        }
        return Object.freeze({ name, rowCount: rows.length, cells: Float64Array.from(cells) });
    });

    if (channelCount > AUDIO90_VOICE_COUNT) throw new Error(`song: ${channelCount} channels is more than the chip's ${AUDIO90_VOICE_COUNT} voices`);
    const order = parseOrder(options.order, patternNames);
    checkOrder(options.order, order, patterns, channelCount, context);
    const loop = checkLoop(options.loop, order.length);
    const volume = options.volume ?? 1;
    if (!(volume > 0)) throw new Error(`song: volume must be above 0; got ${volume}`);

    const song: Audio90Song = Object.freeze({
        chip: 'audio90',
        bpm,
        rowsPerBeat,
        swing,
        channelCount,
        instruments: Object.freeze(instruments),
        instrumentLetters: Object.freeze(letters),
        patterns: Object.freeze(patterns),
        order: Object.freeze(order),
        loop,
        durationMs: computeSongDurationMs({ bpm, rowsPerBeat, order, patterns }),
        volume,
        mixer: Object.freeze(buildMixer(options.mixer ?? [], channelCount)),
        reverb: buildReverb(options.reverb),
        echo: buildEcho(options.echo),
        chorus: buildChorus(options.chorus),
        pump: buildPump(options.pump, channelCount),
        character: checkCharacter(options.character),
    });
    SONGS.add(song);
    return song;
}

/** Whether `value` is a song that `createAudio90Song` made, such as one found among a module's exports. */
export function isAudio90Song(value: unknown): value is Audio90Song {
    return typeof value === 'object' && value !== null && SONGS.has(value);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Every song made, so `isAudio90Song` knows one when it sees it. */
const SONGS = new WeakSet<object>();

/** What parsing a song's cells needs to know of it. */
interface SongContext {
    readonly letters: readonly string[];
    readonly instruments: readonly Audio90Sound[];
}

/** The tokens that set a hex value: each one's prefix, its digits, and where it goes in a cell. */
const HEX_TOKENS: readonly { readonly prefix: string; readonly digits: number; readonly field: number; readonly name: string }[] = [
    { prefix: 'v', digits: 1, field: CELL90_VOLUME, name: 'volumes' },
    { prefix: 'a', digits: 2, field: CELL90_ARPEGGIO, name: 'arpeggios' },
    { prefix: '~', digits: 2, field: CELL90_VIBRATO, name: 'vibratos' },
    { prefix: 'p', digits: 1, field: CELL90_PULSE, name: 'pulse widths' },
    { prefix: 'f', digits: 1, field: CELL90_BRIGHTNESS, name: 'brightnesses' },
    { prefix: 'P', digits: 2, field: CELL90_PAN, name: 'pans' },
    { prefix: 'c', digits: 2, field: CELL90_CHORD, name: 'chords' },
    { prefix: 's', digits: 2, field: CELL90_SLICE, name: 'slices' },
    { prefix: 'r', digits: 1, field: CELL90_REVERB, name: 'reverb sends' },
    { prefix: 'e', digits: 1, field: CELL90_ECHO, name: 'echo sends' },
];

/** Parses one cell's text, appending its `CELL90_STRIDE` numbers to `cells`. */
function parseCell(text: string, where: string, context: SongContext, cells: number[]): void {
    const cell = new Array<number>(CELL90_STRIDE).fill(-1);
    cell[CELL90_NOTE] = NO_NOTE90;
    cell[CELL90_IS_OWN_NOTE] = 0;
    cell[CELL90_GLIDE] = 0;
    cell[CELL90_SLIDE] = 0;
    cell[CELL90_ACCENT] = 0;
    let hasNoteToken = false;
    let hasSlide = false;

    for (const token of splitTokens(text)) {
        if (token === '...') continue;
        const asNote = toNoteNumber(token);
        if (asNote !== undefined || token === '===') {
            if (hasNoteToken) throw new Error(`${where}: two notes`);
            if (asNote !== undefined && !isNoteInRange(asNote)) throw new Error(`${where}: '${token}' is above ${HIGHEST_NOTE_NAME}, the highest note`);
            hasNoteToken = true;
            cell[CELL90_NOTE] = asNote ?? RELEASE90;
            continue;
        }
        // A single letter is an instrument. Every effect's letter has digits after it, so `c37` and `P40` are
        // effects even in a song with instruments named `c` and `P`
        if (token.length === 1 && /[A-Za-z]/.test(token)) {
            if (cell[CELL90_INSTRUMENT] >= 0) throw new Error(`${where}: two instruments`);
            const index = context.letters.indexOf(token);
            if (index < 0) throw new Error(`${where}: unknown instrument '${token}'`);
            cell[CELL90_INSTRUMENT] = index;
            continue;
        }
        if (token === '>' || token === '!') {
            const field = token === '>' ? CELL90_GLIDE : CELL90_ACCENT;
            if (cell[field] === 1) throw new Error(`${where}: two ${token === '>' ? 'glides' : 'accents'}`);
            cell[field] = 1;
            continue;
        }
        if (token === '~') {
            if (cell[CELL90_VIBRATO] >= 0) throw new Error(`${where}: two vibratos`);
            cell[CELL90_VIBRATO] = DEFAULT_VIBRATO90;
            continue;
        }
        const slideUp = parseHexToken(token, 'u', 2);
        const slideDown = parseHexToken(token, 'd', 2);
        if (slideUp !== undefined || slideDown !== undefined) {
            if (hasSlide) throw new Error(`${where}: two slides`);
            hasSlide = true;
            cell[CELL90_SLIDE] = slideUp ?? -(slideDown ?? 0);
            continue;
        }
        const hex = HEX_TOKENS.find((kind) => parseHexToken(token, kind.prefix, kind.digits) !== undefined);
        if (hex === undefined) throw new Error(`${where}: '${token}' is not a note, an instrument or an effect`);
        if (cell[hex.field] >= 0) throw new Error(`${where}: two ${hex.name}`);
        cell[hex.field] = parseHexToken(token, hex.prefix, hex.digits) ?? -1;
    }

    const note = cell[CELL90_NOTE];
    const instrument = cell[CELL90_INSTRUMENT];
    if (note === RELEASE90 && instrument >= 0) throw new Error(`${where}: a release (===) cannot name an instrument`);
    if (note === RELEASE90 && cell[CELL90_VOLUME] >= 0) throw new Error(`${where}: a release (===) cannot take a volume`);
    if (note === NO_NOTE90 && instrument >= 0) {
        // An instrument named alone plays its own note, as drums do
        cell[CELL90_NOTE] = context.instruments[instrument].data.note;
        cell[CELL90_IS_OWN_NOTE] = 1;
    }
    if (cell[CELL90_GLIDE] === 1 && cell[CELL90_NOTE] < 0) throw new Error(`${where}: a glide needs a note to glide to`);
    if (instrument >= 0) checkEngineTokens(cell, 0, where, context.letters[instrument], context.instruments[instrument]);
    for (let i = 0; i < CELL90_STRIDE; i++) cells.push(cell[i]);
}

/**
 * Throws if the cell at `at` in `cells` uses a token that its instrument's
 * engine does not have: a chord or an accent on an instrument that is not
 * analog, or a slice on one that is not a sample, or past its sample's last
 * slice.
 */
function checkEngineTokens(cells: ArrayLike<number>, at: number, where: string, letter: string, instrument: Audio90Sound): void {
    const engine = instrument.data.engine;
    const named = `'${letter}' is ${ENGINE_NAMES[engine]}`;
    const chord = cells[at + CELL90_CHORD];
    if (chord >= 0 && engine !== ENGINE_ANALOG) throw new Error(`${where}: ${formatHex('c', chord)} needs an analog instrument, and ${named}`);
    if (cells[at + CELL90_ACCENT] === 1 && engine !== ENGINE_ANALOG) throw new Error(`${where}: ! needs an analog instrument, and ${named}`);
    const slice = cells[at + CELL90_SLICE];
    if (slice < 0) return;
    if (engine !== ENGINE_SAMPLE || instrument.sample === undefined) throw new Error(`${where}: ${formatHex('s', slice)} needs a sample instrument, and ${named}`);
    const slices = instrument.sample.slices;
    if (slice >= slices) throw new Error(`${where}: ${formatHex('s', slice)} is past the last of the ${slices} slices of '${letter}''s sample`);
}

/** A two-digit hex token, as written in a pattern, such as `c37`. */
function formatHex(prefix: string, value: number): string {
    return prefix + value.toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Walks the order once, as a player first plays it. Throws at the first note
 * on a channel with no instrument named before it, at the first note that
 * its order entry's transposition takes out of the chip's range, and at the
 * first token the channel's instrument does not have.
 */
function checkOrder(
    names: readonly string[],
    order: readonly SongOrderEntry[],
    patterns: readonly Audio90SongPattern[],
    channelCount: number,
    context: SongContext,
): void {
    const channelInstrument = new Array<number>(channelCount).fill(-1);
    for (let i = 0; i < order.length; i++) {
        const { pattern: index, transpose } = order[i];
        const { name, rowCount, cells } = patterns[index];
        for (let row = 0; row < rowCount; row++) {
            for (let channel = 0; channel < channelCount; channel++) {
                const at = (row * channelCount + channel) * CELL90_STRIDE;
                const where = `song: order entry ${i} ('${names[i]}'), pattern '${name}', row ${row}, channel ${channel}`;
                const named = cells[at + CELL90_INSTRUMENT];
                if (named >= 0) channelInstrument[channel] = named;
                const instrument = channelInstrument[channel];
                if (instrument >= 0 && named < 0) checkEngineTokens(cells, at, where, context.letters[instrument], context.instruments[instrument]);
                const note = cells[at + CELL90_NOTE];
                if (note < 0) continue;
                if (instrument < 0) throw new Error(`${where}: a note with no instrument named on this channel before it`);
                const played = note + (cells[at + CELL90_IS_OWN_NOTE] === 1 ? 0 : transpose);
                if (!isNoteInRange(played)) {
                    throw new Error(`${where}: note ${note} transposed by ${transpose} is ${played}, outside the chip's range (${LOWEST_NOTE} to ${HIGHEST_NOTE})`);
                }
            }
        }
    }
}

function buildMixer(mixer: readonly Audio90ChannelMix[], channelCount: number): Required<Audio90ChannelMix>[] {
    if (mixer.length > channelCount) throw new Error(`song: mixer has ${mixer.length} entries, more than the song's ${channelCount} channels`);
    const channels: Required<Audio90ChannelMix>[] = [];
    for (let channel = 0; channel < channelCount; channel++) {
        const mix = mixer.at(channel) ?? {};
        const path = `mixer[${channel}]`;
        channels.push(Object.freeze({
            pan: checkRange(mix.pan ?? 0, -1, 1, `${path}.pan`, 'song'),
            reverb: checkRange(mix.reverb ?? 0, 0, 1, `${path}.reverb`, 'song'),
            echo: checkRange(mix.echo ?? 0, 0, 1, `${path}.echo`, 'song'),
            chorus: checkRange(mix.chorus ?? 0, 0, 1, `${path}.chorus`, 'song'),
        }));
    }
    return channels;
}

function buildReverb(reverb: Audio90ReverbSettings | undefined): Required<Audio90ReverbSettings> | undefined {
    if (reverb === undefined) return undefined;
    const defaults = AUDIO90_EFFECT_DEFAULTS.reverb;
    return Object.freeze({
        size: checkRange(reverb.size ?? defaults.size, 0, 1, 'reverb.size', 'song'),
        decayMs: checkRange(reverb.decayMs ?? defaults.decayMs, 0, Infinity, 'reverb.decayMs', 'song'),
        damping: checkRange(reverb.damping ?? defaults.damping, 0, 1, 'reverb.damping', 'song'),
        level: checkRange(reverb.level ?? defaults.level, 0, 1, 'reverb.level', 'song'),
    });
}

function buildEcho(echo: Audio90EchoSettings | undefined): Audio90SongEcho | undefined {
    if (echo === undefined) return undefined;
    if (echo.timeMs !== undefined && echo.timeBeats !== undefined) throw new Error('song: give echo.timeMs or echo.timeBeats, not both');
    const defaults = AUDIO90_EFFECT_DEFAULTS.echo;
    return Object.freeze({
        timeMs: checkRange(echo.timeMs ?? defaults.timeMs, 0, Infinity, 'echo.timeMs', 'song'),
        timeBeats: echo.timeBeats === undefined ? 0 : checkRange(echo.timeBeats, Number.MIN_VALUE, Infinity, 'echo.timeBeats', 'song'),
        feedback: checkRange(echo.feedback ?? defaults.feedback, 0, 0.95, 'echo.feedback', 'song'),
        toneHz: checkRange(echo.toneHz ?? defaults.toneHz, Number.MIN_VALUE, Infinity, 'echo.toneHz', 'song'),
        isPingPong: echo.isPingPong ?? false,
        level: checkRange(echo.level ?? defaults.level, 0, 1, 'echo.level', 'song'),
    });
}

function buildChorus(chorus: Audio90ChorusSettings | undefined): Required<Audio90ChorusSettings> | undefined {
    if (chorus === undefined) return undefined;
    const defaults = AUDIO90_EFFECT_DEFAULTS.chorus;
    return Object.freeze({
        depth: checkRange(chorus.depth ?? defaults.depth, 0, 1, 'chorus.depth', 'song'),
        rateHz: checkRange(chorus.rateHz ?? defaults.rateHz, 0, Infinity, 'chorus.rateHz', 'song'),
        level: checkRange(chorus.level ?? defaults.level, 0, 1, 'chorus.level', 'song'),
    });
}

function buildPump(pump: Audio90PumpSettings | undefined, channelCount: number): Required<Audio90PumpSettings> | undefined {
    if (pump === undefined) return undefined;
    if (!(Number.isInteger(pump.channel) && pump.channel >= 0 && pump.channel < channelCount)) {
        throw new Error(`song: pump.channel: ${pump.channel} is not one of the song's channels (0 to ${channelCount - 1})`);
    }
    const defaults = AUDIO90_EFFECT_DEFAULTS.pump;
    return Object.freeze({
        channel: pump.channel,
        depth: checkRange(pump.depth ?? defaults.depth, 0, 1, 'pump.depth', 'song'),
        releaseMs: checkRange(pump.releaseMs ?? defaults.releaseMs, 0, Infinity, 'pump.releaseMs', 'song'),
    });
}

function checkCharacter(character: Audio90Character | undefined): Audio90Character | undefined {
    if (character !== undefined && !AUDIO90_CHARACTERS.includes(character)) {
        throw new Error(`song: character: '${String(character)}' is not one of ${AUDIO90_CHARACTERS.join(', ')}`);
    }
    return character;
}
