import { MAZE_COLS, MAZE_ROWS } from '../data';

/** Tile size in pixels. */
export const TILE_SIZE = 20;

/** Height of the HUD area in pixels. */
export const HUD_HEIGHT = 30;

/** Total screen width in pixels. */
export const SCREEN_WIDTH = MAZE_COLS * TILE_SIZE;

/** Total screen height in pixels. */
export const SCREEN_HEIGHT = MAZE_ROWS * TILE_SIZE + HUD_HEIGHT;

/** Ghost colors: Blinky, Pinky, Inky, Clyde. */
export const GHOST_COLORS: number[] = [
    0xff0000, // Blinky - red
    0xffb8ff, // Pinky  - pink
    0x00ffff, // Inky   - cyan
    0xffb852, // Clyde  - orange
];
