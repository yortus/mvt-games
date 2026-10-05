import { FIELD_COLS, FIELD_ROWS } from '../data';

/** Tile size in pixels. */
export const TILE_SIZE = 20;

/** Height of the HUD area in pixels. */
export const HUD_HEIGHT = 30;

/** Total screen width in pixels. */
export const SCREEN_WIDTH = FIELD_COLS * TILE_SIZE;

/** Total screen height in pixels. */
export const SCREEN_HEIGHT = FIELD_ROWS * TILE_SIZE + HUD_HEIGHT;
