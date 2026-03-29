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
export const FIGHTER_BODY_WIDTH = 0.5;

/** Player starting position in metres. */
export const FIGHTER_START_LEFT_X = 2.5;

/** Opponent starting position in metres. */
export const FIGHTER_START_RIGHT_X = 7.5;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Points needed to win one round. */
export const POINTS_TO_WIN_ROUND = 3;

/** Rounds needed to win the match (best of 3). */
export const ROUNDS_TO_WIN_MATCH = 2;

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
