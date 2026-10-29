// The tracker notation's cells, which every chip's songs share. Which tokens
// a cell may hold, and what they mean, each chip says in its `CellGrammar`.
// Every cell starts with the same fields, and a chip's own fields follow.

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

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
