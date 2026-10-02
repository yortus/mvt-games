import { VISIBLE_COLS, VISIBLE_ROWS } from '../data';

/** Tile size in pixels. */
export const TILE_SIZE = 16;

/** Width of the play area in pixels. */
export const SCREEN_WIDTH = VISIBLE_COLS * TILE_SIZE;

/** Height of the play area in pixels. */
export const PLAY_HEIGHT = VISIBLE_ROWS * TILE_SIZE;

/** Height of the HUD bar at the bottom. */
export const HUD_HEIGHT = 24;

/** Total screen height in pixels. */
export const SCREEN_HEIGHT = PLAY_HEIGHT + HUD_HEIGHT;
