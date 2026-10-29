import { HIGHEST_NOTE, HIGHEST_NOTE_NAME, LOWEST_NOTE, toNoteNumber } from './notes';

// The tracker notation, which every chip's songs and step tables share:
// rows, comments, cells, tokens, the order of patterns and the loop, and the
// parts of a song every chip's song has. Which tokens a cell may hold, and
// what they mean, each chip says in its `CellGrammar`.

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

/** One pattern of a song: rows of cells, one cell per channel. */
export interface SongPattern {
    /** Its name in the song's options' `patterns`. */
    readonly name: string;
    /** How many rows it has, 1 or more. */
    readonly rowCount: number;
    /**
     * The cells, the chip's `CellGrammar.stride` numbers each. They run row
     * by row, and within a row, channel by channel. Each cell starts with the
     * fields every chip's cells have, `CELL_NOTE` to `CELL_PULSE`.
     */
    readonly cells: Float64Array;
}

/** A song's tempo, as its options give it. */
export interface SongTempo {
    readonly bpm: number;
    readonly rowsPerBeat?: number;
    readonly swing?: number;
}

/** What `computeSongDurationMs` reads of a song, as it is made. */
export interface SongTiming {
    readonly bpm: number;
    readonly rowsPerBeat: number;
    readonly order: readonly SongOrderEntry[];
    readonly patterns: readonly { readonly rowCount: number }[];
}

/** What every chip's song options have. */
export interface SongCoreOptions<I> extends SongTempo {
    readonly instruments: Readonly<Record<string, I>>;
    readonly patterns: Readonly<Record<string, string>>;
    readonly order: readonly string[];
    readonly loop?: number;
    readonly volume?: number;
}

/** What every chip's song has, as `parseSongCore` makes it. */
export interface SongCore<I> {
    readonly bpm: number;
    readonly rowsPerBeat: number;
    readonly swing: number;
    readonly channelCount: number;
    readonly instruments: readonly I[];
    readonly instrumentLetters: readonly string[];
    readonly patterns: readonly SongPattern[];
    readonly order: readonly SongOrderEntry[];
    readonly loop: number;
    readonly durationMs: number;
    readonly volume: number;
}

/**
 * The tokens a chip's cells may hold, in the order a cell is written, and
 * how many numbers each cell takes. Every chip's grammar starts with
 * `COMMON_CELL_TOKENS`.
 */
export interface CellGrammar {
    /** How many numbers each cell takes. */
    readonly stride: number;
    readonly tokens: readonly CellToken[];
}

/**
 * One kind of token a cell may hold, after its note and instrument:
 *
 * - `hex`, a prefix and hex digits, such as `v9` or `P40`, setting `field`
 *   to the digits' value. With `bare`, the prefix alone sets that value, as
 *   `~` sets a default vibrato. The field is -1 without one.
 * - `flag`, a token such as `>`, setting `field` to 1. It is 0 without one.
 * - `slide`, `u` or `d` and two hex digits, setting `CELL_SLIDE` to that many
 *   semitones up or down. It is 0 without one.
 *
 * `name` is what an error calls two of them, such as `volumes`.
 */
export type CellToken =
    | { readonly kind: 'hex'; readonly prefix: string; readonly digits: number; readonly field: number; readonly name: string; readonly bare?: number }
    | { readonly kind: 'flag'; readonly token: string; readonly field: number; readonly name: string }
    | { readonly kind: 'slide'; readonly name: string };

/**
 * What `parseSongCore` needs of a chip: its cell grammar, its voices, and
 * what its instruments say about their cells.
 */
export interface SongChip<I> {
    readonly grammar: CellGrammar;
    readonly voiceCount: number;
    /** The note instrument `instrument` plays when a cell names it with no note, as a drum's cell does. */
    readonly ownNote: (instrument: I) => number;
    /**
     * Throws, with an error that starts with `where`, if the cell at `at` in
     * `cells` holds a token that instrument `letter` cannot play. It is
     * called for each cell with an instrument, named there or before it on
     * the channel. Optional.
     */
    readonly checkCell?: (cells: ArrayLike<number>, at: number, where: string, letter: string, instrument: I) => void;
}

// The fields every chip's cells start with. A chip's own fields follow, from `CELL_PULSE + 1`

/** A note number, or `NO_NOTE` or `RELEASE`. */
export const CELL_NOTE = 0;
/** 1 if the note is the instrument's own, which transposition leaves alone. */
export const CELL_IS_OWN_NOTE = 1;
/** An index into the song's instruments, or -1. */
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

/** A `CELL_NOTE` for a cell with no note. The channel's note plays on. */
export const NO_NOTE = -1;
/** A `CELL_NOTE` for a release, written `===`. The channel's note fades out. */
export const RELEASE = -2;

/** The vibrato a bare `~` plays, packed as `CELL_VIBRATO` packs it. It is a quarter of a semitone, six times a second. */
export const DEFAULT_VIBRATO = 2 * 16 + 6;

/** The tokens every chip's cells have, in the order a cell is written: `v9`, `a37`, `~` or `~46`, `>`, `u0C` or `d0C`, and `p8`. */
export const COMMON_CELL_TOKENS: readonly CellToken[] = [
    { kind: 'hex', prefix: 'v', digits: 1, field: CELL_VOLUME, name: 'volumes' },
    { kind: 'hex', prefix: 'a', digits: 2, field: CELL_ARPEGGIO, name: 'arpeggios' },
    { kind: 'hex', prefix: '~', digits: 2, field: CELL_VIBRATO, name: 'vibratos', bare: DEFAULT_VIBRATO },
    { kind: 'flag', token: '>', field: CELL_GLIDE, name: 'glides' },
    { kind: 'slide', name: 'slides' },
    { kind: 'hex', prefix: 'p', digits: 1, field: CELL_PULSE, name: 'pulse widths' },
];

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Makes the parts of a song that every chip's song has: its tempo, its
 * instruments, its patterns parsed by the chip's grammar, its order, its
 * loop and its volume. If anything is not valid, it throws an error that
 * says where. Examples are a cell that does not parse, a note on a channel
 * with no instrument named before it, and a note transposed out of the
 * chip's range.
 */
export function parseSongCore<I>(options: SongCoreOptions<I>, chip: SongChip<I>): SongCore<I> {
    const { bpm } = options;
    const { rowsPerBeat, swing } = checkTempo(options);

    const letters = Object.keys(options.instruments);
    checkInstrumentLetters(letters);
    const instruments = letters.map((letter) => options.instruments[letter]);

    let channelCount = 0;
    const patternNames = Object.keys(options.patterns);
    if (patternNames.length === 0) throw new Error('song: no patterns');
    const patterns = patternNames.map((name): SongPattern => {
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
                parseCell(texts[channel], `song: pattern '${name}', row ${row}, channel ${channel}`, letters, instruments, chip, cells);
            }
        }
        return Object.freeze({ name, rowCount: rows.length, cells: Float64Array.from(cells) });
    });

    if (channelCount > chip.voiceCount) throw new Error(`song: ${channelCount} channels is more than the chip's ${chip.voiceCount} voices`);
    const order = parseOrder(options.order, patternNames);
    checkOrder(options.order, order, patterns, channelCount, letters, instruments, chip);
    const loop = checkLoop(options.loop, order.length);
    const volume = options.volume ?? 1;
    if (!(volume > 0)) throw new Error(`song: volume must be above 0; got ${volume}`);

    return {
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
    };
}

/** A hex token as a pattern writes it, such as `v9` or `P40`. */
export function formatHexToken(prefix: string, value: number, digits: number): string {
    return prefix + value.toString(16).toUpperCase().padStart(digits, '0');
}

/** The note number of a name such as `C-4`. If the name is not a note in range, throws an error that starts with `where`. */
export function parseNote(name: string, where: string): number {
    const note = parseNoteToken(name, where);
    if (note === undefined) throw new Error(`${where}: '${name}' is not a note (write C-4, F#5)`);
    return note;
}

/**
 * The note number of a token such as `C-4`, or undefined if it is not a
 * note. Throws an error that starts with `where` if it is a note above the
 * highest.
 */
export function parseNoteToken(token: string, where: string): number | undefined {
    const note = toNoteNumber(token);
    if (note !== undefined && !isNoteInRange(note)) throw new Error(`${where}: '${token}' is above ${HIGHEST_NOTE_NAME}, the highest note`);
    return note;
}

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

/** Parses one cell's text by the chip's grammar, appending its numbers to `cells`. */
function parseCell<I>(text: string, where: string, letters: readonly string[], instruments: readonly I[], chip: SongChip<I>, cells: number[]): void {
    const { grammar } = chip;
    const cell = new Array<number>(grammar.stride).fill(-1);
    cell[CELL_NOTE] = NO_NOTE;
    cell[CELL_IS_OWN_NOTE] = 0;
    cell[CELL_SLIDE] = 0;
    for (const token of grammar.tokens) if (token.kind === 'flag') cell[token.field] = 0;
    const seen = new Array<boolean>(grammar.tokens.length).fill(false);
    let hasNoteToken = false;

    for (const token of splitTokens(text)) {
        if (token === '...') continue;
        const asNote = parseNoteToken(token, where);
        if (asNote !== undefined || token === '===') {
            if (hasNoteToken) throw new Error(`${where}: two notes`);
            hasNoteToken = true;
            cell[CELL_NOTE] = asNote ?? RELEASE;
            continue;
        }
        // A single letter is an instrument. Every effect's letter has digits after it, so `v9` and `P40` are
        // effects even in a song with instruments named `v` and `P`
        if (token.length === 1 && /[A-Za-z]/.test(token)) {
            if (cell[CELL_INSTRUMENT] >= 0) throw new Error(`${where}: two instruments`);
            const index = letters.indexOf(token);
            if (index < 0) throw new Error(`${where}: unknown instrument '${token}'`);
            cell[CELL_INSTRUMENT] = index;
            continue;
        }
        const kind = grammar.tokens.findIndex((candidate) => readToken(candidate, token) !== undefined);
        if (kind < 0) throw new Error(`${where}: '${token}' is not a note, an instrument or an effect`);
        const found = grammar.tokens[kind];
        if (seen[kind]) throw new Error(`${where}: two ${found.name}`);
        seen[kind] = true;
        cell[found.kind === 'slide' ? CELL_SLIDE : found.field] = readToken(found, token) ?? -1;
    }

    const note = cell[CELL_NOTE];
    const instrument = cell[CELL_INSTRUMENT];
    if (note === RELEASE && instrument >= 0) throw new Error(`${where}: a release (===) cannot name an instrument`);
    if (note === RELEASE && cell[CELL_VOLUME] >= 0) throw new Error(`${where}: a release (===) cannot take a volume`);
    if (note === NO_NOTE && instrument >= 0) {
        // An instrument named alone plays its own note, as drums do
        cell[CELL_NOTE] = chip.ownNote(instruments[instrument]);
        cell[CELL_IS_OWN_NOTE] = 1;
    }
    if (cell[CELL_GLIDE] === 1 && cell[CELL_NOTE] < 0) throw new Error(`${where}: a glide needs a note to glide to`);
    if (instrument >= 0) chip.checkCell?.(cell, 0, where, letters[instrument], instruments[instrument]);
    for (let i = 0; i < grammar.stride; i++) cells.push(cell[i]);
}

/** The value `text` sets as a token of kind `token`, or undefined if it is not one. */
function readToken(token: CellToken, text: string): number | undefined {
    switch (token.kind) {
        case 'flag':
            return text === token.token ? 1 : undefined;
        case 'slide': {
            const up = parseHexToken(text, 'u', 2);
            if (up !== undefined) return up;
            const down = parseHexToken(text, 'd', 2);
            return down === undefined ? undefined : -down;
        }
        default:
            return token.bare !== undefined && text === token.prefix ? token.bare : parseHexToken(text, token.prefix, token.digits);
    }
}

/**
 * Walks the order once, as a player first plays it. Throws at the first note
 * on a channel with no instrument named before it, at the first note that
 * its order entry's transposition takes out of the chip's range, and at the
 * first token the channel's instrument cannot play.
 */
function checkOrder<I>(
    names: readonly string[],
    order: readonly SongOrderEntry[],
    patterns: readonly SongPattern[],
    channelCount: number,
    letters: readonly string[],
    instruments: readonly I[],
    chip: SongChip<I>,
): void {
    const stride = chip.grammar.stride;
    const channelInstrument = new Array<number>(channelCount).fill(-1);
    for (let i = 0; i < order.length; i++) {
        const { pattern: index, transpose } = order[i];
        const { name, rowCount, cells } = patterns[index];
        for (let row = 0; row < rowCount; row++) {
            for (let channel = 0; channel < channelCount; channel++) {
                const at = (row * channelCount + channel) * stride;
                const where = `song: order entry ${i} ('${names[i]}'), pattern '${name}', row ${row}, channel ${channel}`;
                const named = cells[at + CELL_INSTRUMENT];
                if (named >= 0) channelInstrument[channel] = named;
                const instrument = channelInstrument[channel];
                // A cell that names its instrument was checked as it was parsed
                if (instrument >= 0 && named < 0) chip.checkCell?.(cells, at, where, letters[instrument], instruments[instrument]);
                const note = cells[at + CELL_NOTE];
                if (note < 0) continue;
                if (instrument < 0) throw new Error(`${where}: a note with no instrument named on this channel before it`);
                const played = note + (cells[at + CELL_IS_OWN_NOTE] === 1 ? 0 : transpose);
                if (!isNoteInRange(played)) {
                    throw new Error(`${where}: note ${note} transposed by ${transpose} is ${played}, outside the chip's range (${LOWEST_NOTE} to ${HIGHEST_NOTE})`);
                }
            }
        }
    }
}
