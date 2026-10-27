import { HIGHEST_NOTE, LOWEST_NOTE } from './notes';

// The tracker notation's grammar, which every chip's songs and step tables
// share: rows, comments, cells, tokens, the order of patterns and the loop.
// What a cell's tokens mean is each chip's own.

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** One entry in a song's playing order: a pattern, and how far to transpose it. */
export interface SongOrderEntry {
    /** The pattern's index in the song's patterns. */
    readonly pattern: number;
    /** Semitones added to the pattern's written notes. An instrument's own note is not transposed. */
    readonly transpose: number;
}

/** A song's tempo, as its options give it. */
export interface SongTempo {
    readonly bpm: number;
    readonly rowsPerBeat?: number;
    readonly swing?: number;
}

/** What `computeSongDurationMs` reads of a song, which any chip's song has. */
export interface SongTiming {
    readonly bpm: number;
    readonly rowsPerBeat: number;
    readonly order: readonly SongOrderEntry[];
    readonly patterns: readonly { readonly rowCount: number }[];
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** How long one pass through `song`'s order lasts, in ms, at its own tempo, for either chip's song. Swing does not change it. */
export function computeSongDurationMs(song: SongTiming): number {
    let rows = 0;
    for (let i = 0; i < song.order.length; i++) rows += song.patterns[song.order[i].pattern].rowCount;
    return rows * 60000 / (song.bpm * song.rowsPerBeat);
}

/**
 * Splits a pattern or a step table into its rows, one per line, with each
 * line's indentation trimmed. A `#` starts a comment when it begins the line
 * or follows a space, and the comment runs to the end of the line. So
 * `| C-4 L  # bar 2` is a row with a comment after it, while `F#5` is a
 * note. Lines left blank once their comments are removed are skipped.
 */
export function splitRows(text: string): string[] {
    const rows: string[] = [];
    for (const line of text.split('\n')) {
        const comment = COMMENT.exec(line);
        const trimmed = (comment === null ? line : line.slice(0, comment.index)).trim();
        if (trimmed !== '') rows.push(trimmed);
    }
    return rows;
}

/**
 * Splits a pattern's row into the text of its cells. A row starts with `|`,
 * as each of its cells does. Throws an error that starts with `where` if the
 * row does not.
 */
export function splitCells(row: string, where: string): string[] {
    if (!row.startsWith('|')) throw new Error(`${where}: a row starts with |`);
    // Dropping the row's first `|` leaves the cells between the rest
    return row.slice(1).split('|');
}

/** Splits a cell or a step row into tokens, which are the words between spaces. */
export function splitTokens(text: string): string[] {
    const trimmed = text.trim();
    return trimmed === '' ? [] : trimmed.split(/\s+/);
}

/** The value of a token made of `prefix` then `digits` hex digits, such as `v9` or `a37`. Undefined if the token is not one. */
export function parseHexToken(token: string, prefix: string, digits: number): number | undefined {
    if (!token.startsWith(prefix) || token.length !== prefix.length + digits) return undefined;
    const hex = token.slice(prefix.length);
    if (!HEX.test(hex)) return undefined;
    return parseInt(hex, 16);
}

/** A relative pitch token's semitones (`+7`, `-12`, `+0`), or undefined if it is not one. */
export function parseRelativePitch(token: string): number | undefined {
    return RELATIVE.test(token) ? Number(token) : undefined;
}

/** Whether a song or a sound may play a note number. The range is `LOWEST_NOTE` to `HIGHEST_NOTE`. */
export function isNoteInRange(note: number): boolean {
    return note >= LOWEST_NOTE && note <= HIGHEST_NOTE;
}

/** Checks a song's tempo, and returns its rows per beat and swing with their defaults. Throws if any is not valid. */
export function checkTempo(tempo: SongTempo): { readonly rowsPerBeat: number; readonly swing: number } {
    const { bpm } = tempo;
    if (!(Number.isFinite(bpm) && bpm > 0)) throw new Error(`song: bpm must be above 0; got ${bpm}`);
    const rowsPerBeat = tempo.rowsPerBeat ?? 4;
    if (!(Number.isInteger(rowsPerBeat) && rowsPerBeat > 0)) throw new Error(`song: rowsPerBeat must be a whole number, 1 or more; got ${rowsPerBeat}`);
    const swing = tempo.swing ?? 0;
    if (!(swing >= 0 && swing <= 0.5)) throw new Error(`song: swing must be from 0 to 0.5; got ${swing}`);
    return { rowsPerBeat, swing };
}

/** Checks that each instrument's name is one letter, as a pattern names it. */
export function checkInstrumentLetters(letters: readonly string[]): void {
    for (const letter of letters) {
        if (!/^[A-Za-z]$/.test(letter)) throw new Error(`song: instrument '${letter}' needs a one-letter name`);
    }
}

/**
 * Parses a song's order: pattern names, each of which may add a
 * transposition in semitones, as in `'verse+5'`. Throws if the order is
 * empty, or names a pattern that is not in `patternNames`.
 */
export function parseOrder(order: readonly string[], patternNames: readonly string[]): SongOrderEntry[] {
    if (order.length === 0) throw new Error('song: order is empty');
    return order.map((entry) => {
        // Match a whole pattern name first, so 'part-2' finds a pattern named 'part-2', not 'part' transposed down two
        const whole = patternNames.indexOf(entry);
        if (whole >= 0) return { pattern: whole, transpose: 0 };
        const match = /^(.*?)([+-]\d+)?$/.exec(entry);
        const index = match === null ? -1 : patternNames.indexOf(match[1]);
        if (match === null || index < 0) throw new Error(`song: order names '${entry}', which is not a pattern`);
        return { pattern: index, transpose: match[2] === undefined ? 0 : Number(match[2]) };
    });
}

/** Checks a song's loop point, and returns it, or -1 for a song that plays once. */
export function checkLoop(loop: number | undefined, orderLength: number): number {
    const at = loop ?? -1;
    if (at !== -1 && (at < 0 || at >= orderLength || at !== Math.floor(at))) {
        throw new Error(`song: loop ${at} is not an index into its order (0 to ${orderLength - 1})`);
    }
    return at;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A `#` at the start of a line or after whitespace, which starts a comment. */
const COMMENT = /(?:^|\s)#/;
const HEX = /^[0-9A-Fa-f]+$/;
const RELATIVE = /^[+-]\d{1,2}$/;
