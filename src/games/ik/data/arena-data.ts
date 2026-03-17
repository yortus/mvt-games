// ---------------------------------------------------------------------------
// Arena / World Constants
// ---------------------------------------------------------------------------

/** Arena width in world units. */
export const ARENA_WIDTH = 10.0;

/** Left boundary (centre of leftmost fighter position). */
export const ARENA_MIN_X = 0.5;

/** Right boundary (centre of rightmost fighter position). */
export const ARENA_MAX_X = 9.5;

/** Fighter hittable body width in world units. */
export const FIGHTER_BODY_WIDTH = 0.8;

/** Player starting position (world units). */
export const FIGHTER_START_LEFT_X = 2.5;

/** Opponent starting position (world units). */
export const FIGHTER_START_RIGHT_X = 7.5;

// ---------------------------------------------------------------------------
// Screen / Pixel Constants (view-layer only)
// ---------------------------------------------------------------------------

/** Pixel width of rendered game. */
export const SCREEN_WIDTH = 384;

/** Pixel height (play area + HUD). */
export const SCREEN_HEIGHT = 270;

/** Pixel height of HUD bar. */
export const HUD_HEIGHT = 30;

/** Pixel Y for ground line. */
export const GROUND_Y_PX = 210;

/** Sprite frame pixel width. */
export const FRAME_WIDTH = 48;

/** Sprite frame pixel height. */
export const FRAME_HEIGHT = 42;

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

/** Walk speed in world units per second. */
export const WALK_SPEED = 2.0;

/** Full jump arc duration in ms. */
export const JUMP_DURATION_MS = 500;

/** Peak jump height in world units. */
export const JUMP_HEIGHT = 2.5;

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/** 30-second round timer. */
export const ROUND_TIMER_MS = 30_000;

/** Points needed to win one round. */
export const POINTS_TO_WIN_ROUND = 3;

/** Rounds needed to win the match (best of 3). */
export const ROUNDS_TO_WIN_MATCH = 2;

/** Pause before fighting starts (ms). */
export const ROUND_INTRO_DELAY_MS = 2000;

/** Pause after a point is scored (ms). */
export const POINT_SCORED_DELAY_MS = 1500;

/** Pause showing winner/loser poses (ms). */
export const ROUND_OVER_DELAY_MS = 3000;

/** Duration of hit stagger (ms). */
export const HIT_REACTION_MS = 400;

/** Duration of block animation (ms). */
export const BLOCK_REACTION_MS = 300;
