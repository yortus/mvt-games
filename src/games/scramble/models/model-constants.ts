// ---------------------------------------------------------------------------
// Scroll
// ---------------------------------------------------------------------------

/** Forced scroll speed in tiles per second. */
export const SCROLL_SPEED = 3;

// ---------------------------------------------------------------------------
// Ship Constants
// ---------------------------------------------------------------------------

/** Ship movement speed in tiles per second (player-controlled). */
export const SHIP_SPEED = 6;

/** Starting column for the ship (world coords, matches initial scroll + offset). */
export const SHIP_START_COL = 5;

/** Starting row for the ship. */
export const SHIP_START_ROW = 7;

/** Minimum screen-relative column the ship can occupy. */
export const SHIP_MIN_SCREEN_COL = 1;

/** Maximum screen-relative column the ship can occupy. */
export const SHIP_MAX_SCREEN_COL = 18;

/** Minimum row the ship can occupy. */
export const SHIP_MIN_ROW = 0.5;

/** Maximum row the ship can occupy. */
export const SHIP_MAX_ROW = 13.5;

// ---------------------------------------------------------------------------
// Bullet Constants
// ---------------------------------------------------------------------------

/** Maximum simultaneous player bullets. */
export const MAX_BULLETS = 4;

/** Bullet speed in tiles per second (rightward in world space). */
export const BULLET_SPEED = 15;

// ---------------------------------------------------------------------------
// Bomb Constants
// ---------------------------------------------------------------------------

/** Maximum simultaneous bombs. */
export const MAX_BOMBS = 2;

/** Bomb forward speed relative to scroll in tiles per second. */
export const BOMB_FORWARD_SPEED = 4;

/** Bomb gravity in tiles per second squared. */
export const BOMB_GRAVITY = 20;

// ---------------------------------------------------------------------------
// Collision
// ---------------------------------------------------------------------------

/** Ship collision half-size in tile units. */
export const SHIP_HALF_SIZE = 0.4;

// ---------------------------------------------------------------------------
// Enemy Constants
// ---------------------------------------------------------------------------

/** Maximum simultaneous rockets. */
export const MAX_ROCKETS = 8;

/** Horizontal tile distance at which a rocket detects the ship and launches. */
export const ROCKET_DETECT_RANGE = 8;

/** Rocket upward launch speed in tiles per second. */
export const ROCKET_LAUNCH_SPEED = 8;

/** Maximum simultaneous UFOs. */
export const MAX_UFOS = 6;

/** UFO leftward speed in tiles per second. */
export const UFO_SPEED = 4;

/** UFO vertical sine oscillation amplitude in tiles. */
export const UFO_OSCILLATION_AMP = 1.5;

/** UFO vertical sine oscillation frequency in Hz. */
export const UFO_OSCILLATION_FREQ = 2;

/** Maximum simultaneous fuel tanks. */
export const MAX_FUEL_TANKS = 6;

/** Enemy collision half-size in tile units. */
export const ENEMY_HALF_SIZE = 0.4;

// ---------------------------------------------------------------------------
// Fuel Constants
// ---------------------------------------------------------------------------

/** Fuel depletion rate per second (full tank = 1.0). */
export const FUEL_DEPLETION_RATE = 0.03;

/** Fuel gained per fuel tank destroyed (fraction of full tank). */
export const FUEL_REFILL_AMOUNT = 0.25;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Points for destroying a rocket. */
export const SCORE_ROCKET = 50;

/** Points for destroying a UFO. */
export const SCORE_UFO = 100;

/** Points for destroying a fuel tank. */
export const SCORE_FUEL_TANK = 150;

/** Points for destroying the base target. */
export const SCORE_BASE = 800;

// ---------------------------------------------------------------------------
// Lives
// ---------------------------------------------------------------------------

/** Number of lives the player starts with. */
export const INITIAL_LIVES = 3;

// ---------------------------------------------------------------------------
// Spawn
// ---------------------------------------------------------------------------

/** Columns ahead of the visible right edge to activate spawns. */
export const SPAWN_AHEAD = 2;

// ---------------------------------------------------------------------------
// Section Progression
// ---------------------------------------------------------------------------

/** Delay in ms after section clear before transitioning. */
export const SECTION_CLEAR_DELAY_MS = 2000;

/** Additional scroll speed per loop in tiles per second. */
export const SPEED_INCREASE_PER_LOOP = 0.5;

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/** Delay in ms after dying before respawn or game-over. */
export const DYING_DELAY_MS = 1500;

/** Delay in ms for respawn invulnerability. */
export const RESPAWN_DELAY_MS = 1500;

// ---------------------------------------------------------------------------
// Explosions
// ---------------------------------------------------------------------------

/** Maximum simultaneous explosions. */
export const MAX_EXPLOSIONS = 8;

/** Duration of an explosion in ms. */
export const EXPLOSION_DURATION_MS = 400;
