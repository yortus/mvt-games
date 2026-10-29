import { type CellGrammar, COMMON_CELL_TOKENS, parseSongCore, type SongOrderEntry, type SongPattern } from '../../shared';
import { type Audio80FilterId, type Audio80FilterMode, AUDIO80_VOICE_COUNT } from '../synthesiser';
import type { Audio80Sound } from './audio80-sound';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A song, ready to play. `createAudio80Song` makes it from patterns written as text.
 * A pattern is a grid of cells, with one row per time step and one cell per
 * channel in each row. Each cell is stored as numbers, so the chip's
 * sequencer can read them with plain index loops.
 */
export interface Audio80Song {
    /** The chip it plays on. */
    readonly chip: 'audio80';
    /** Beats per minute, above 0. */
    readonly bpm: number;
    /** How many rows make a beat, as a whole number, 1 or more. */
    readonly rowsPerBeat: number;
    /** How late each odd-numbered row of a pattern plays, as a share of a row, from 0 to 0.5. */
    readonly swing: number;
    /** How many cells each row has, one per channel. The chip plays channel n on voice n. */
    readonly channelCount: number;
    /** The song's instruments, the sounds it plays, in the order that a cell's `CELL_INSTRUMENT` indexes them. */
    readonly instruments: readonly Audio80Sound[];
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
    /** Filters `a` and `b`, as the song sets them as it starts. */
    readonly filters: readonly (Audio80FilterSettings | undefined)[];
    /** The echo, as the song sets it as it starts, or undefined to leave it as it is. */
    readonly echo: Audio80EchoSettings | undefined;
    /** A gain on every note. At 1, the notes play as written. */
    readonly volume: number;
}

/** A filter's settings, as a song sets them as it starts. */
export interface Audio80FilterSettings {
    /** Which frequencies it lets through. */
    readonly mode: Audio80FilterMode;
    /** Its cutoff frequency, in Hz. */
    readonly cutoffHz: number;
    /** How much the filter boosts frequencies near the cutoff, 0 to 1. Defaults to 0. */
    readonly resonance?: number;
    /** How hard the filter's input is driven into distortion, 0 to 1. Defaults to 0. */
    readonly drive?: number;
}

/** The echo's settings, as a song sets them as it starts. */
export interface Audio80EchoSettings {
    /** How long after a sound its echo comes, in ms. */
    readonly timeMs: number;
    /** How much of each repeat feeds into the next, 0 to 1. Defaults to 0.35. */
    readonly feedback?: number;
    /** How loud the echo is, 0 to 1. Defaults to 0.5. */
    readonly level?: number;
}

/**
 * How many numbers each cell takes in `SongPattern.cells`. A cell starts with
 * the fields every chip's cells have, `CELL_NOTE` to `CELL_PULSE`, and ends
 * with the Audio80's own.
 */
export const CELL80_STRIDE = 10;
/** A cutoff level, 0 to 15, or -1. */
export const CELL80_FILTER = 9;

/** The tokens an Audio80's cells may hold, in the order a cell is written. */
const AUDIO80_CELL_GRAMMAR: CellGrammar = {
    stride: CELL80_STRIDE,
    tokens: [...COMMON_CELL_TOKENS, { kind: 'hex', prefix: 'f', digits: 1, field: CELL80_FILTER, name: 'cutoffs' }],
};

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What `createAudio80Song` makes a song from. */
export interface Audio80SongOptions {
    /** Beats per minute, above 0. */
    readonly bpm: number;
    /** How many rows make a beat, as a whole number, 1 or more. Defaults to 4, which makes a row a sixteenth note. */
    readonly rowsPerBeat?: number;
    /** How late each odd-numbered row of a pattern plays, as a share of a row, from 0 to 0.5. Defaults to 0. */
    readonly swing?: number;
    /** The song's instruments: the sounds it plays, each named by the one letter the patterns use for it. */
    readonly instruments: Readonly<Record<string, Audio80Sound>>;
    /**
     * The song's patterns, by name. Each pattern is a multiline string, with
     * one row on each line. A `#` at the start of a line or after a space
     * starts a comment, which runs to the end of the line, so a pattern can
     * have column headings and notes. `F#5` is a note, not a comment. Blank
     * lines and comment lines are not rows. Each row has one cell per
     * channel, and each cell starts with `|`, so a row starts with one too.
     * A cell is tokens separated by spaces. Each of these may appear at most
     * once:
     *
     * - a note such as `C-4`, or `...` or nothing for no note
     * - `===` to release the note
     * - an instrument's letter
     * - effects: `v9`, `a37`, `~`, `~46`, `>`, `u0C`, `d0C`, `p8` and `f8`
     */
    readonly patterns: Readonly<Record<string, string>>;
    /** Pattern names in playing order. Each may add a transposition in semitones, as in `'verse+5'`. */
    readonly order: readonly string[];
    /** The index in `order` to go back to at the end. Without it, the song plays once. */
    readonly loop?: number;
    /** Filters `a` and `b`, set as the song starts. Defaults to leaving them as they are. */
    readonly filters?: Readonly<Partial<Record<Audio80FilterId, Audio80FilterSettings>>>;
    /** The echo, set as the song starts. Defaults to leaving it as it is. */
    readonly echo?: Audio80EchoSettings;
    /**
     * A gain on every note, above 0. The default, 1, plays the notes as
     * written. Use it to bring a whole song to the loudness the other songs
     * share, `REFERENCE_LOUDNESS_LUFS`, without changing its balance.
     */
    readonly volume?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a song from patterns written as text. If anything is not valid, it
 * throws an error that says where. Examples are a cell that does not parse, a
 * note on a channel with no instrument named before it, and a note transposed
 * out of the chip's range.
 */
export function createAudio80Song(options: Audio80SongOptions): Audio80Song {
    const core = parseSongCore(options, { grammar: AUDIO80_CELL_GRAMMAR, voiceCount: AUDIO80_VOICE_COUNT, ownNote: (sound) => sound.data.note });
    const song: Audio80Song = Object.freeze({
        chip: 'audio80',
        ...core,
        filters: [options.filters?.a, options.filters?.b],
        echo: options.echo,
    });
    SONGS.add(song);
    return song;
}

/** Whether `value` is a song that `createAudio80Song` made, such as one found among a module's exports. */
export function isAudio80Song(value: unknown): value is Audio80Song {
    return typeof value === 'object' && value !== null && SONGS.has(value);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Every song made, so `isAudio80Song` knows one when it sees it. */
const SONGS = new WeakSet<object>();
