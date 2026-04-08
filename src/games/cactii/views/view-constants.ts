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

/** Pastel background-panel colour for each cactus kind. */
export const PANEL_COLOURS: Record<CactusKind, number> = {
    astrophytum: 0xFFB3BA, // soft rose
    cereus: 0xBAE1FF, // soft sky blue
    euphorbia: 0xBAFFCD, // soft mint
    ferocactus: 0xFFDFBA, // soft peach
    opuntia: 0xE8BAFF, // soft lavender
    rebutia: 0xFFFBBA, // soft lemon
};
