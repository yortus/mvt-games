// ---------------------------------------------------------------------------
// Arena / World Constants
//
// All world-space distances are in metres. The arena is 10 m wide.
// ---------------------------------------------------------------------------

/** Arena width in metres. */
export const ARENA_WIDTH = 10.0;

/** Left boundary in metres (centre of leftmost fighter position). */
export const ARENA_MIN_X = 0.5;

/** Right boundary in metres (centre of rightmost fighter position). */
export const ARENA_MAX_X = 9.5;

/** Fighter hittable body width in metres. */
export const FIGHTER_BODY_WIDTH = 0.8;

/** Player starting position in metres. */
export const FIGHTER_START_LEFT_X = 2.5;

/** Opponent starting position in metres. */
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
export const GROUND_Y_PX = 160;

/** Sprite frame pixel width. */
export const FRAME_WIDTH = 48;

/** Sprite frame pixel height. */
export const FRAME_HEIGHT = 42;

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

/** Walk speed in metres per second. */
export const WALK_SPEED = 2.0;

/** Full jump arc duration in ms. */
export const JUMP_DURATION_MS = 500;

/** Peak jump height in metres. */
export const JUMP_HEIGHT = 0.55;

/** Distance in metres for one complete walk animation cycle. */
export const WALK_CYCLE_METRES = 2.0;

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

// ---------------------------------------------------------------------------
// Phase Animation Timing
//
// Shared between model (total duration for progress) and view (frame mapping).
// ---------------------------------------------------------------------------

/** Turn animation: 0-based texture indices into the turn texture array. */
export const TURN_TEXTURE_SEQUENCE: readonly number[] = [0];

/** Duration of each turn frame in ms. */
export const TURN_FRAME_MS = 80;

/** Total turn animation duration in ms. */
export const TURN_TOTAL_MS = TURN_TEXTURE_SEQUENCE.length * TURN_FRAME_MS;

/** Number of defeat animation frames. */
export const DEFEAT_FRAME_COUNT = 3;

/** Duration of each defeat frame in ms. */
export const DEFEAT_FRAME_MS = 120;

/** Total defeat animation duration in ms. */
export const DEFEAT_TOTAL_MS = DEFEAT_FRAME_COUNT * DEFEAT_FRAME_MS;

/** Duration of each won-pose toggle in ms. */
export const WON_TOGGLE_MS = 300;

/** Number of won-pose toggles before holding. */
export const WON_TOGGLE_COUNT = 4;

/** Total won-pose animation duration in ms. */
export const WON_TOTAL_MS = WON_TOGGLE_COUNT * WON_TOGGLE_MS;
