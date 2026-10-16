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

/** Ship movement speed in world-units per second. */
export const SHIP_SPEED = 150;

/** Half-width of the ship for clamping in world-units. */
export const SHIP_HALF_WIDTH = 12;

// ---------------------------------------------------------------------------
// Bullet Constants
// ---------------------------------------------------------------------------

/** Maximum simultaneous player bullets. */
export const MAX_PLAYER_BULLETS = 2;

/** Player bullet speed in world-units per second (upward). */
export const BULLET_SPEED = 350;

/** Maximum simultaneous enemy bullets. */
export const MAX_ENEMY_BULLETS = 8;

/** Enemy bullet speed in world-units per second (downward). */
export const ENEMY_BULLET_SPEED = 150;

// ---------------------------------------------------------------------------
// Collision
// ---------------------------------------------------------------------------

/** Squared collision radius in world-units. */
export const HIT_RADIUS_SQ = 10 * 10;
