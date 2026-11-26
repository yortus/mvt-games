import { ARENA_WIDTH, ARENA_HEIGHT, FORMATION_COLS } from '../data';

// ---------------------------------------------------------------------------
// Formation Positioning
// ---------------------------------------------------------------------------

/** Spacing between formation slots in world-units. */
export const CELL_SIZE = 24;

/** X offset of the left edge of the formation grid in world-units. */
export const FORMATION_LEFT = (ARENA_WIDTH - FORMATION_COLS * CELL_SIZE) / 2;

/** Y offset of the top edge of the formation grid in world-units. */
export const FORMATION_TOP = 40;

// ---------------------------------------------------------------------------
// Ship Constants
// ---------------------------------------------------------------------------

/** Y position of the player ship in world-units. */
export const SHIP_Y = ARENA_HEIGHT - 24;

/** Half-width of the ship for clamping in world-units. */
export const SHIP_HALF_WIDTH = 12;

// ---------------------------------------------------------------------------
// Bullet Pools
// ---------------------------------------------------------------------------

/** Maximum simultaneous player bullets. */
export const MAX_PLAYER_BULLETS = 2;

/** Maximum simultaneous enemy bullets. */
export const MAX_ENEMY_BULLETS = 8;
