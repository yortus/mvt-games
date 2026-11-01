import type { GemKind } from '../models';

// Where the board is drawn, which every view of it shares. The model's
// cells are rows and columns, and these turn them into pixels.

/** The size of a cell, in pixels. */
export const CELL_PX = 48;

/** Where the board's top left corner is, in pixels. */
export const BOARD_X = 152;
export const BOARD_Y = 96;

/** The x of the middle of a column. */
export function toCellX(col: number): number {
    return BOARD_X + (col + 0.5) * CELL_PX;
}

/** The y of the middle of a row. */
export function toCellY(row: number): number {
    return BOARD_Y + (row + 0.5) * CELL_PX;
}

/** The colour of each kind of gem. */
export const GEM_COLORS: Readonly<Record<GemKind, number>> = {
    ruby: 0xe8475a,
    amber: 0xf2a93b,
    jade: 0x3fc28a,
    sapphire: 0x3f8ff2,
    amethyst: 0xa86ef0,
};
