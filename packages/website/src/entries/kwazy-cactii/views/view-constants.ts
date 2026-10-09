import { GRID_ROWS, GRID_COLS } from '../data';
import type { CactusKind } from '../models';

/** Width of one grid cell in pixels (matches texture width). */
export const CELL_WIDTH_PX = 200;

/** Height of one grid cell in pixels (matches texture height). */
export const CELL_HEIGHT_PX = 250;

/** Height of the HUD bar below the board in pixels. */
export const HUD_HEIGHT = 180;

/** Total screen width in pixels. */
export const SCREEN_WIDTH = GRID_COLS * CELL_WIDTH_PX;

/** Total screen height in pixels. */
export const SCREEN_HEIGHT = GRID_ROWS * CELL_HEIGHT_PX + HUD_HEIGHT;

/**
 * The first cascade step that sets off fireworks. The fireworks are drawn
 * and heard from this step on, so both views read this one value.
 */
export const MIN_CASCADE_FOR_FIREWORKS = 3;

/** The fewest cactii a match must clear, counting every line in it, to sparkle as it goes. */
export const MIN_CELLS_FOR_BIG_MATCH = 5;

/** Pastel background-panel colour for each cactus kind. */
export const PANEL_COLOURS: Record<CactusKind, number> = {
    astrophytum: 0xFFB3BA, // soft rose
    cereus: 0xBAE1FF, // soft sky blue
    ferocactus: 0xFFDFBA, // soft peach
    gymnocalycium: 0xBAFFCD, // soft mint
    opuntia: 0xE8BAFF, // soft lavender
    rebutia: 0xFFFBBA, // soft lemon
};
