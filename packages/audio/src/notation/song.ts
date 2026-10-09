import { type FilterId, type FilterMode, HIGHEST_NOTE, HIGHEST_NOTE_NAME, LOWEST_NOTE, toNoteNumber, VOICE_COUNT } from '../core';
import type { Instrument } from './instrument';
import { parseHexToken, isNoteInRange, splitRows, splitTokens } from './tokens';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A song, ready to play. `createSong` makes it from patterns written as text.
 * A pattern is a grid of cells, with one row per time step and one cell per
 * channel in each row. Each cell is stored as numbers, so the music player
 * can read them with plain index loops.
 */
export interface Song {
    /** Beats per minute, above 0. */
    readonly bpm: number;
    /** How many rows make a beat, as a whole number, 1 or more. */
    readonly rowsPerBeat: number;
    /** How late each odd-numbered row of a pattern plays, as a share of a row, from 0 to 0.5. */
    readonly swing: number;
    /** How many cells each row has, one per channel. The music player plays channel n on voice n. */
    readonly channelCount: number;
    /** The song's instruments, in the order that a cell's `CELL_INSTRUMENT` indexes them. */
    readonly instruments: readonly Instrument[];
    /** The song's patterns, in the order that `SongOrderEntry.pattern` indexes them. */
    readonly patterns: readonly SongPattern[];
    /** The patterns in playing order. */
    readonly order: readonly SongOrderEntry[];
    /** The index in `order` to go back to at the end, or -1 to play once. */
    readonly loop: number;
    /** Filters `a` and `b`, as the song sets them as it starts. */
    readonly filters: readonly (FilterSettings | undefined)[];
    /** The echo, as the song sets it as it starts, or undefined to leave it as it is. */
    readonly echo: EchoSettings | undefined;
    /** A gain on every note. At 1, the notes play as written. */
    readonly volume: number;
}

/** One pattern of a song: rows of cells, one cell per channel. */
export interface SongPattern {
    /** Its name in `SongOptions.patterns`. */
    readonly name: string;
    /** How many rows it has, 1 or more. */
    readonly rowCount: number;
    /** The cells, `CELL_STRIDE` numbers each. They run row by row, and within a row, channel by channel. */
    readonly cells: Float64Array;
}

/** One entry in a song's playing order: a pattern, and how far to transpose it. */
export interface SongOrderEntry {
    /** The pattern's index in `Song.patterns`. */
    readonly pattern: number;
    /** Semitones added to the pattern's written notes. An instrument's own note is not transposed. */
    readonly transpose: number;
}

/** A filter's settings, as a song sets them as it starts. */
export interface FilterSettings {
    /** Which frequencies it lets through. */
    readonly mode: FilterMode;
    /** Its cutoff frequency, in Hz. */
    readonly cutoffHz: number;
    /** How much the filter boosts frequencies near the cutoff, 0 to 1. Defaults to 0. */
    readonly resonance?: number;
    /** How hard the filter's input is driven into distortion, 0 to 1. Defaults to 0. */
    readonly drive?: number;
}

/** The echo's settings, as a song sets them as it starts. */
export interface EchoSettings {
    /** How long after a sound its echo comes, in ms. */
    readonly timeMs: number;
    /** How much of each repeat feeds into the next, 0 to 1. Defaults to 0.35. */
    readonly feedback?: number;
    /** How loud the echo is, 0 to 1. Defaults to 0.5. */
    readonly level?: number;
}

/** How many numbers each cell takes in `SongPattern.cells`. The other `CELL_*` constants are offsets within a cell. */
export const CELL_STRIDE = 10;
/** A note number, or `NO_NOTE` or `RELEASE`. */
export const CELL_NOTE = 0;
/** 1 if the note is the instrument's own, which transposition leaves alone. */
export const CELL_IS_OWN_NOTE = 1;
/** An index into `instruments`, or -1. */
export const CELL_INSTRUMENT = 2;
/** The note's volume, 0 to 15, or -1. */
export const CELL_VOLUME = 3;
/** Two semitone offsets packed as `x * 16 + y`, or -1. */
export const CELL_ARPEGGIO = 4;
/** The vibrato's depth in eighths of a semitone and rate in Hz, packed as `depth * 16 + rate`, or -1. */
export const CELL_VIBRATO = 5;
/** 1 to glide from the last note, or 0. */
export const CELL_GLIDE = 6;
/** Semitones to slide by over the row, or 0. */
export const CELL_SLIDE = 7;
/** A pulse width in sixteenths, or -1. */
export const CELL_PULSE = 8;
/** A cutoff level, 0 to 15, or -1. */
export const CELL_FILTER = 9;

/** A `CELL_NOTE` for a cell with no note. The channel's note plays on. */
export const NO_NOTE = -1;
/** A `CELL_NOTE` for a release, written `===`. The channel's note fades out. */
export const RELEASE = -2;

/** The vibrato a bare `~` plays, packed as `CELL_VIBRATO` packs it. It is a quarter of a semitone, six times a second. */
export const DEFAULT_VIBRATO = 2 * 16 + 6;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What `createSong` makes a song from. */
export interface SongOptions {
    /** Beats per minute, above 0. */
    readonly bpm: number;
    /** How many rows make a beat, as a whole number, 1 or more. Defaults to 4, which makes a row a sixteenth note. */
    readonly rowsPerBeat?: number;
    /** How late each odd-numbered row of a pattern plays, as a share of a row, from 0 to 0.5. Defaults to 0. */
    readonly swing?: number;
    /** The song's instruments, each named by the one letter the patterns use for it. */
    readonly instruments: Readonly<Record<string, Instrument>>;
    /**
     * The song's patterns, by name. Each pattern is a multiline string, with
     * one row on each line. Blank lines and lines that start with `//` are
     * not rows, so a pattern can have comments, such as column headings.
     * Each row has one cell per channel, separated by `|`. A cell is tokens
     * separated by spaces. Each of these may appear at most once:
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
    readonly filters?: Readonly<Partial<Record<FilterId, FilterSettings>>>;
    /** The echo, set as the song starts. Defaults to leaving it as it is. */
    readonly echo?: EchoSettings;
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
export function createSong(options: SongOptions): Song {
    const { bpm } = options;
    if (!(Number.isFinite(bpm) && bpm > 0)) throw new Error(`song: bpm must be above 0; got ${bpm}`);
    const rowsPerBeat = options.rowsPerBeat ?? 4;
    if (!(Number.isInteger(rowsPerBeat) && rowsPerBeat > 0)) throw new Error(`song: rowsPerBeat must be a whole number, 1 or more; got ${rowsPerBeat}`);
    const swing = options.swing ?? 0;
    if (!(swing >= 0 && swing <= 0.5)) throw new Error(`song: swing must be from 0 to 0.5; got ${swing}`);

    const letters = Object.keys(options.instruments);
    for (const letter of letters) {
        if (!/^[A-Za-z]$/.test(letter)) throw new Error(`song: instrument '${letter}' needs a one-letter name`);
    }
    const instruments = letters.map((letter) => options.instruments[letter]);

    let channelCount = 0;
    const patternNames = Object.keys(options.patterns);
    if (patternNames.length === 0) throw new Error('song: no patterns');
    const patterns = patternNames.map((name) => {
        const rows = splitRows(options.patterns[name]);
        if (rows.length === 0) throw new Error(`song: pattern '${name}' has no rows`);
        const cells: number[] = [];
        for (let row = 0; row < rows.length; row++) {
            const texts = rows[row].split('|');
            if (channelCount === 0) channelCount = texts.length;
            if (texts.length !== channelCount) {
                throw new Error(`song: pattern '${name}', row ${row}: expected ${channelCount} cells (one per channel), found ${texts.length}`);
            }
            for (let channel = 0; channel < texts.length; channel++) {
                const where = `song: pattern '${name}', row ${row}, channel ${channel}`;
                parseCell(texts[channel], where, letters, instruments, cells);
            }
        }
        return { name, rowCount: rows.length, cells: Float64Array.from(cells) };
    });

    if (channelCount > VOICE_COUNT) throw new Error(`song: ${channelCount} channels is more than the chip's ${VOICE_COUNT} voices`);
    if (options.order.length === 0) throw new Error('song: order is empty');
    const order = options.order.map((entry) => {
        // Match a whole pattern name first, so 'part-2' finds a pattern named 'part-2', not 'part' transposed down two
        const whole = patternNames.indexOf(entry);
        if (whole >= 0) return { pattern: whole, transpose: 0 };
        const match = /^(.*?)([+-]\d+)?$/.exec(entry);
        const index = match === null ? -1 : patternNames.indexOf(match[1]);
        if (match === null || index < 0) throw new Error(`song: order names '${entry}', which is not a pattern`);
        return { pattern: index, transpose: match[2] === undefined ? 0 : Number(match[2]) };
    });
    checkOrder(options.order, order, patterns, channelCount);

    const loop = options.loop ?? -1;
    if (loop !== -1 && (loop < 0 || loop >= order.length || loop !== Math.floor(loop))) {
        throw new Error(`song: loop ${loop} is not an index into its order (0 to ${order.length - 1})`);
    }
    const volume = options.volume ?? 1;
    if (!(volume > 0)) throw new Error(`song: volume must be above 0; got ${volume}`);

    const song: Song = Object.freeze({
        bpm,
        rowsPerBeat,
        swing,
        channelCount,
        instruments,
        patterns,
        order,
        loop,
        filters: [options.filters?.a, options.filters?.b],
        echo: options.echo,
        volume,
    });
    SONGS.add(song);
    return song;
}

/** Whether `value` is a song that `createSong` made, such as one found among a module's exports. */
export function isSong(value: unknown): value is Song {
    return typeof value === 'object' && value !== null && SONGS.has(value);
}

/** How long one pass through `song`'s order lasts, in ms, at its own tempo. Swing does not change it. */
export function computeSongDurationMs(song: Song): number {
    let rows = 0;
    for (let i = 0; i < song.order.length; i++) rows += song.patterns[song.order[i].pattern].rowCount;
    return rows * 60000 / (song.bpm * song.rowsPerBeat);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Every song made, so `isSong` knows one when it sees it. */
const SONGS = new WeakSet<object>();

/** Parses one cell's text, appending its `CELL_STRIDE` numbers to `cells`. */
function parseCell(
    text: string,
    where: string,
    letters: readonly string[],
    instruments: readonly Instrument[],
    cells: number[],
): void {
    let note = NO_NOTE;
    let isOwnNote = 0;
    let instrument = -1;
    let volume = -1;
    let arpeggio = -1;
    let vibrato = -1;
    let glide = 0;
    let slide = 0;
    let hasSlide = false;
    let pulse = -1;
    let filter = -1;
    let hasNoteToken = false;

    for (const token of splitTokens(text)) {
        if (token === '...') continue;
        const asNote = toNoteNumber(token);
        if (asNote !== undefined || token === '===') {
            if (hasNoteToken) throw new Error(`${where}: two notes`);
            if (asNote !== undefined && !isNoteInRange(asNote)) {
                throw new Error(`${where}: '${token}' is above ${HIGHEST_NOTE_NAME}, the highest note`);
            }
            hasNoteToken = true;
            note = asNote ?? RELEASE;
            continue;
        }
        // A single letter is an instrument. An effect's letter always has digits after it, so `v9` and
        // `u0C` are effects even in a song with instruments named `v` and `u`
        if (token.length === 1 && /[A-Za-z]/.test(token)) {
            if (instrument >= 0) throw new Error(`${where}: two instruments`);
            instrument = letters.indexOf(token);
            if (instrument < 0) throw new Error(`${where}: unknown instrument '${token}'`);
            continue;
        }
        if (token === '>') {
            if (glide === 1) throw new Error(`${where}: two glides`);
            glide = 1;
            continue;
        }
        const asVibrato = token === '~' ? DEFAULT_VIBRATO : parseHexToken(token, '~', 2);
        const asVolume = parseHexToken(token, 'v', 1);
        const asArpeggio = parseHexToken(token, 'a', 2);
        const asSlideUp = parseHexToken(token, 'u', 2);
        const asSlideDown = parseHexToken(token, 'd', 2);
        const asPulse = parseHexToken(token, 'p', 1);
        const asFilter = parseHexToken(token, 'f', 1);
        if (asVolume !== undefined) {
            if (volume >= 0) throw new Error(`${where}: two volumes`);
            volume = asVolume;
        }
        else if (asArpeggio !== undefined) {
            if (arpeggio >= 0) throw new Error(`${where}: two arpeggios`);
            arpeggio = asArpeggio;
        }
        else if (asVibrato !== undefined) {
            if (vibrato >= 0) throw new Error(`${where}: two vibratos`);
            vibrato = asVibrato;
        }
        else if (asSlideUp !== undefined || asSlideDown !== undefined) {
            if (hasSlide) throw new Error(`${where}: two slides`);
            hasSlide = true;
            slide = asSlideUp ?? -(asSlideDown ?? 0);
        }
        else if (asPulse !== undefined) {
            if (pulse >= 0) throw new Error(`${where}: two pulse widths`);
            pulse = asPulse;
        }
        else if (asFilter !== undefined) {
            if (filter >= 0) throw new Error(`${where}: two cutoffs`);
            filter = asFilter;
        }
        else {
            throw new Error(`${where}: '${token}' is not a note, an instrument or an effect`);
        }
    }

    if (note === RELEASE && instrument >= 0) throw new Error(`${where}: a release (===) cannot name an instrument`);
    if (note === RELEASE && volume >= 0) throw new Error(`${where}: a release (===) cannot take a volume`);
    if (note === NO_NOTE && instrument >= 0) {
        // An instrument named alone plays its own note, as drums do
        note = instruments[instrument].note;
        isOwnNote = 1;
    }
    if (glide === 1 && note < 0) throw new Error(`${where}: a glide needs a note to glide to`);

    cells.push(note, isOwnNote, instrument, volume, arpeggio, vibrato, glide, slide, pulse, filter);
}

/**
 * Walks the order once, as the player first plays it. Throws at the first
 * note on a channel with no instrument named before it. Also throws at the
 * first note that its order entry's transposition takes out of the chip's
 * range.
 */
function checkOrder(
    names: readonly string[],
    order: readonly SongOrderEntry[],
    patterns: readonly SongPattern[],
    channelCount: number,
): void {
    const hasInstrument = new Array<boolean>(channelCount).fill(false);
    for (let i = 0; i < order.length; i++) {
        const { pattern: index, transpose } = order[i];
        const { name, rowCount, cells } = patterns[index];
        for (let row = 0; row < rowCount; row++) {
            for (let channel = 0; channel < channelCount; channel++) {
                const at = (row * channelCount + channel) * CELL_STRIDE;
                if (cells[at + CELL_INSTRUMENT] >= 0) hasInstrument[channel] = true;
                const note = cells[at + CELL_NOTE];
                if (note < 0) continue;
                const where = `song: order entry ${i} ('${names[i]}'), pattern '${name}', row ${row}, channel ${channel}`;
                if (!hasInstrument[channel]) throw new Error(`${where}: a note with no instrument named on this channel before it`);
                const played = note + (cells[at + CELL_IS_OWN_NOTE] === 1 ? 0 : transpose);
                if (!isNoteInRange(played)) {
                    throw new Error(`${where}: note ${note} transposed by ${transpose} is ${played}, outside the chip's range (${LOWEST_NOTE} to ${HIGHEST_NOTE})`);
                }
            }
        }
    }
}
