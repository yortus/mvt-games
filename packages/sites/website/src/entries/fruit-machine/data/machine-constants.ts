// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Rows in the window. */
export const ROW_COUNT = 3;

/** Credits each spin costs. */
export const BET = 25;

/** Credits the machine starts with: four spins' worth. */
export const STARTING_BALANCE = 4 * BET;

/** How fast a spinning reel turns, in strip positions per second. */
export const SPIN_SPEED = 20;

/** When the first reel starts to settle, from the start of a spin. */
export const FIRST_SETTLE_MS = 1000;

/** How much later each reel starts to settle than the one to its left. */
export const SETTLE_STAGGER_MS = 500;

/** How long a reel takes to settle onto its stop. */
export const SETTLE_MS = 500;

/** How far a reel travels while it settles, in strip positions. */
export const SETTLE_DISTANCE = 3;

/** The longest a reel takes to land once a spin is stopped. */
export const STOPPING_SETTLE_MS = 200;

/** How long the celebration's opening step, showing every winning cell, lasts. */
export const CELEBRATION_OPENER_MS = 1500;

/** How long the celebration shows each winning way. */
export const CELEBRATION_STEP_MS = 800;
