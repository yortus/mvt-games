import { CELL_GLIDE, CELL_INSTRUMENT, CELL_IS_OWN_NOTE, CELL_NOTE, CELL_SLIDE, CELL_VOLUME, type CellGrammar, type CellToken, NO_NOTE, RELEASE } from './cell-grammar';
import { checkLoop } from './check-loop';
import { checkTempo } from './check-tempo';
import { computeSongDurationMs } from './compute-song-duration-ms';
import { HIGHEST_NOTE, isNoteInRange, LOWEST_NOTE } from './notes';
import { parseHexToken } from './parse-hex-token';
import { parseNoteToken } from './parse-note-token';
import { parseOrder } from './parse-order';
import type { SongCore, SongCoreOptions, SongOrderEntry, SongPattern } from './song-core';
import { splitCells } from './split-cells';
import { splitRows } from './split-rows';
import { splitTokens } from './split-tokens';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Checks that each instrument's name is one letter, as a pattern names it. */
function checkInstrumentLetters(letters: readonly string[]): void {
    for (const letter of letters) {
        if (!/^[A-Za-z]$/.test(letter)) throw new Error(`song: instrument '${letter}' needs a one-letter name`);
    }
}

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
