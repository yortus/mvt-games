// ---------------------------------------------------------------------------
// Arena Constants (world-units)
// ---------------------------------------------------------------------------

/** Width of the play area in world-units. */
export const ARENA_WIDTH = 400;

/** Height of the play area (above HUD) in world-units. */
export const ARENA_HEIGHT = 400;

// ---------------------------------------------------------------------------
// Screen Constants (view-layer only)
// ---------------------------------------------------------------------------

/** Height of the HUD bar at the bottom in pixels. */
export const HUD_HEIGHT = 30;

// ---------------------------------------------------------------------------
// Ship Constants
// ---------------------------------------------------------------------------

/** Ship rotation speed in radians per second. */
export const SHIP_ROTATION_SPEED = 5;

/** Ship thrust acceleration in world-units per second². */
export const SHIP_THRUST = 200;

/** Ship drag factor - multiplied per second (0–1). */
export const SHIP_DRAG = 0.98;

/** Maximum ship speed in world-units per second. */
export const SHIP_MAX_SPEED = 250;

/** Ship collision radius in world-units. */
export const SHIP_RADIUS = 10;

// ---------------------------------------------------------------------------
// Bullet Constants
// ---------------------------------------------------------------------------

/** Maximum simultaneous player bullets. */
export const MAX_BULLETS = 6;

/** Bullet speed in world-units per second. */
export const BULLET_SPEED = 400;

/** Bullet lifetime in milliseconds. */
export const BULLET_LIFETIME_MS = 800;

/** Bullet collision radius. */
export const BULLET_RADIUS = 2;

// ---------------------------------------------------------------------------
// Asteroid Constants
// ---------------------------------------------------------------------------

/** Collision radii per asteroid size in world-units. */
export const ASTEROID_RADIUS_LARGE = 30;
export const ASTEROID_RADIUS_MEDIUM = 16;
export const ASTEROID_RADIUS_SMALL = 8;

/** Speed range for large asteroids in world-units per second. */
export const ASTEROID_MIN_SPEED = 30;
export const ASTEROID_MAX_SPEED = 70;

/** Speed multiplier when an asteroid splits. */
export const ASTEROID_SPLIT_SPEED_MULT = 1.6;

// ---------------------------------------------------------------------------
// Wave Constants
// ---------------------------------------------------------------------------

/** Base number of large asteroids in wave 1. */
export const WAVE_BASE_ASTEROIDS = 4;

/** Additional large asteroids per wave. */
export const WAVE_ASTEROID_INCREMENT = 1;

/** Maximum large asteroids per wave. */
export const WAVE_MAX_ASTEROIDS = 11;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Points for destroying a large asteroid. */
export const SCORE_LARGE = 20;

/** Points for destroying a medium asteroid. */
export const SCORE_MEDIUM = 50;

/** Points for destroying a small asteroid. */
export const SCORE_SMALL = 100;

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/** Delay in ms after clearing a wave before spawning the next. */
export const WAVE_CLEAR_DELAY_MS = 1500;

/** Delay in ms after dying before respawning or game-over. */
export const DYING_DELAY_MS = 1500;

/** Duration in ms of the reverse-explode respawn animation. */
export const RESPAWN_ANIM_MS = 1000;

/** Minimum distance from ship centre when spawning asteroids (world-units). */
export const SPAWN_SAFE_RADIUS = 80;
