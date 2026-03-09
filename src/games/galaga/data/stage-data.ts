// ---------------------------------------------------------------------------
// Screen Constants
// ---------------------------------------------------------------------------

/** Width of the play area in pixels. */
export const SCREEN_WIDTH = 280;

/** Height of the play area (above HUD) in pixels. */
export const PLAY_HEIGHT = 360;

/** Height of the HUD bar at the bottom. */
export const HUD_HEIGHT = 30;

// ---------------------------------------------------------------------------
// Formation Constants
// ---------------------------------------------------------------------------

/** Number of columns in the enemy formation grid. */
export const FORMATION_COLS = 10;

/** Number of rows in the enemy formation grid. */
export const FORMATION_ROWS = 5;

/** Spacing between formation slots in pixels. */
export const CELL_SIZE = 24;

/** X pixel of the left edge of the formation grid. */
export const FORMATION_LEFT = (SCREEN_WIDTH - FORMATION_COLS * CELL_SIZE) / 2;

/** Y pixel of the top edge of the formation grid. */
export const FORMATION_TOP = 40;

// ---------------------------------------------------------------------------
// Ship Constants
// ---------------------------------------------------------------------------

/** Y position of the player ship in pixels. */
export const SHIP_Y = PLAY_HEIGHT - 24;

/** Ship movement speed in pixels per second. */
export const SHIP_SPEED = 150;

/** Half-width of the ship for clamping. */
export const SHIP_HALF_WIDTH = 12;

// ---------------------------------------------------------------------------
// Bullet Constants
// ---------------------------------------------------------------------------

/** Maximum simultaneous player bullets. */
export const MAX_PLAYER_BULLETS = 2;

/** Player bullet speed in pixels per second (upward). */
export const BULLET_SPEED = 350;

/** Maximum simultaneous enemy bullets. */
export const MAX_ENEMY_BULLETS = 8;

/** Enemy bullet speed in pixels per second (downward). */
export const ENEMY_BULLET_SPEED = 150;

// ---------------------------------------------------------------------------
// Collision
// ---------------------------------------------------------------------------

/** Squared collision radius in pixels. */
export const HIT_RADIUS_SQ = 10 * 10;
