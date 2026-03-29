import { GRID_ROWS, GRID_COLS } from '../data';

/** Size of one grid cell in pixels. */
export const CELL_SIZE_PX = 40;

/** Height of the HUD bar below the board in pixels. */
export const HUD_HEIGHT = 36;

/** Total screen width in pixels. */
export const SCREEN_WIDTH = GRID_COLS * CELL_SIZE_PX;

/** Total screen height in pixels. */
export const SCREEN_HEIGHT = GRID_ROWS * CELL_SIZE_PX + HUD_HEIGHT;
