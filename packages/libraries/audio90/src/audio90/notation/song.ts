import { type CellGrammar, COMMON_CELL_TOKENS, printHexToken, MAX_ECHO_FEEDBACK, parseSongCore, type SongOrderEntry, type SongPattern } from '../../shared';
import { type Audio90Character, AUDIO90_CHARACTERS, AUDIO90_EFFECT_DEFAULTS, AUDIO90_VOICE_COUNT } from '../synthesiser';
import { type Audio90Sound, checkRange } from './sound';

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
    /** The song's instruments, in the order that a cell's `CELL_INSTRUMENT` indexes them. */
    readonly instruments: readonly Audio90Sound[];
    /** Each instrument's letter, as the patterns name it, in the order of `instruments`. */
    readonly instrumentLetters: readonly string[];
    /** The song's patterns, in the order that `SongOrderEntry.pattern` indexes them. */
    readonly patterns: readonly SongPattern[];
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

/** One pattern of an Audio90 song: rows of cells, one cell per channel, `CELL90_STRIDE` numbers each. */
export type Audio90SongPattern = SongPattern;

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

/**
 * How many numbers each cell takes in `Audio90SongPattern.cells`. A cell
 * starts with the fields every chip's cells have, `CELL_NOTE` to
 * `CELL_PULSE`, in the shared folder's tracker, and ends with the Audio90's
 * own.
 */
export const CELL90_STRIDE = 16;
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

/** The tokens an Audio90's cells may hold, in the order a cell is written. */
export const AUDIO90_CELL_GRAMMAR: CellGrammar = {
    stride: CELL90_STRIDE,
    tokens: [
        ...COMMON_CELL_TOKENS,
        { kind: 'hex', prefix: 'f', digits: 1, field: CELL90_BRIGHTNESS, name: 'brightnesses' },
        { kind: 'hex', prefix: 'P', digits: 2, field: CELL90_PAN, name: 'pans' },
        { kind: 'hex', prefix: 'c', digits: 2, field: CELL90_CHORD, name: 'chords' },
        { kind: 'hex', prefix: 's', digits: 2, field: CELL90_SLICE, name: 'slices' },
        { kind: 'hex', prefix: 'r', digits: 1, field: CELL90_REVERB, name: 'reverb sends' },
        { kind: 'hex', prefix: 'e', digits: 1, field: CELL90_ECHO, name: 'echo sends' },
        { kind: 'flag', token: '!', field: CELL90_ACCENT, name: 'accents' },
    ],
};

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
    const core = parseSongCore(options, {
        grammar: AUDIO90_CELL_GRAMMAR,
        voiceCount: AUDIO90_VOICE_COUNT,
        ownNote: (sound) => sound.data.note,
        checkCell: checkEngineTokens,
    });
    const song: Audio90Song = Object.freeze({
        chip: 'audio90',
        ...core,
        mixer: Object.freeze(buildMixer(options.mixer ?? [], core.channelCount)),
        reverb: buildReverb(options.reverb),
        echo: buildEcho(options.echo),
        chorus: buildChorus(options.chorus),
        pump: buildPump(options.pump, core.channelCount),
        character: checkCharacter(options.character),
    });
    SONGS.set(song, options);
    return song;
}

/** Whether `value` is a song that `createAudio90Song` made, such as one found among a module's exports. */
export function isAudio90Song(value: unknown): value is Audio90Song {
    return typeof value === 'object' && value !== null && SONGS.has(value);
}

/** The options `createAudio90Song` made `song` from, as a song's text holds them. Undefined for a song it did not make. */
export function findAudio90SongOptions(song: Audio90Song): Audio90SongOptions | undefined {
    return SONGS.get(song);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Every song made, and the options it was made from, so `isAudio90Song` knows one when it sees it, and its text can be printed. */
const SONGS = new WeakMap<object, Audio90SongOptions>();

/**
 * Throws if the cell at `at` in `cells` uses a token that its instrument's
 * engine does not have: a chord or an accent on an instrument that is not
 * analog, or a slice on one that is not a sample, or past its sample's last
 * slice.
 */
function checkEngineTokens(cells: ArrayLike<number>, at: number, where: string, letter: string, instrument: Audio90Sound): void {
    const { engine } = instrument;
    const named = `'${letter}' is ${engine}`;
    const chord = cells[at + CELL90_CHORD];
    if (chord >= 0 && engine !== 'analog') throw new Error(`${where}: ${printHexToken('c', chord, 2)} needs an analog instrument, and ${named}`);
    if (cells[at + CELL90_ACCENT] === 1 && engine !== 'analog') throw new Error(`${where}: ! needs an analog instrument, and ${named}`);
    const slice = cells[at + CELL90_SLICE];
    if (slice < 0) return;
    if (engine !== 'sample' || instrument.sample === undefined) throw new Error(`${where}: ${printHexToken('s', slice, 2)} needs a sample instrument, and ${named}`);
    const slices = instrument.sample.slices;
    if (slice >= slices) throw new Error(`${where}: ${printHexToken('s', slice, 2)} is past the last of the ${slices} slices of '${letter}''s sample`);
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
        feedback: checkRange(echo.feedback ?? defaults.feedback, 0, MAX_ECHO_FEEDBACK, 'echo.feedback', 'song'),
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
