import { MAZE_COLS, MAZE_ROWS } from '../data';

/** Tile size in pixels. */
export const TILE_SIZE = 20;

/** Height of the HUD area in pixels. */
export const HUD_HEIGHT = 30;

/** Total screen width in pixels. */
export const SCREEN_WIDTH = MAZE_COLS * TILE_SIZE;

/** Total screen height in pixels. */
export const SCREEN_HEIGHT = MAZE_ROWS * TILE_SIZE + HUD_HEIGHT;

/** Coat colours, one per cat, in the order of their spawns. */
export const CAT_COLORS: number[] = [
    0x8fa3bf, // blue-grey
    0xf0e0b8, // cream
    0xa07850, // tabby brown
    0x7c7c88, // charcoal
];

/** The path between the hedges. */
export const PATH_COLOR = 0x2a2116;

/** Hedge fill, and the lighter leaves drawn over it. */
export const HEDGE_COLOR = 0x2f6b2a;
export const HEDGE_LEAF_COLOR = 0x4c9a3c;

/** Crumbs of cheese. */
export const CRUMB_COLOR = 0xf2c94c;
