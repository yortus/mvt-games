import { GRID_ROWS, GRID_COLS } from '../data';

/** Width of one grid cell in pixels (matches texture width). */
export const CELL_WIDTH_PX = 200;

/** Height of one grid cell in pixels (matches texture height). */
export const CELL_HEIGHT_PX = 280;

/** Height of the HUD bar below the board in pixels. */
export const HUD_HEIGHT = 180;

/** Total screen width in pixels. */
export const SCREEN_WIDTH = GRID_COLS * CELL_WIDTH_PX;

/** Total screen height in pixels. */
export const SCREEN_HEIGHT = GRID_ROWS * CELL_HEIGHT_PX + HUD_HEIGHT;
