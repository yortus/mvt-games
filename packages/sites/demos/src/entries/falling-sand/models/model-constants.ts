import type { ToolKind } from './demo-model';

/**
 * Tuning for the demo's model: the tank's size, the timestep, pouring and
 * flipping, and the rules grains move by. All in domain units (cells, steps
 * and milliseconds), never pixels; the view's sizes are in `view-constants.ts`.
 */

// --- The tank -----------------------------------------------------------------

/** The tank sizes to choose from. */
export type TankSizeKind = 'small' | 'medium' | 'large';

/**
 * The tank sizes to choose from, in cells. Each is drawn the same size on
 * screen, with smaller cells for more of them. `brushScale` widens the brush
 * with the tank, so pouring fills each about as fast for its size.
 */
export const TANK_SIZES: Readonly<Record<TankSizeKind, TankSize>> = {
    small: { cols: 152, rows: 180, brushScale: 1 },
    medium: { cols: 228, rows: 270, brushScale: 1.5 },
    large: { cols: 456, rows: 540, brushScale: 3 },
};

export interface TankSize {
    readonly cols: number;
    readonly rows: number;
    readonly brushScale: number;
}

// --- Time ---------------------------------------------------------------------

/** Milliseconds per simulation step: 60 steps per second, whatever the frame rate. */
export const STEP_MS = 1000 / 60;

/** Steps one update may run before dropping the backlog. */
export const MAX_STEPS_PER_UPDATE = 4;

/** How long the tank takes to turn upside down. */
export const FLIP_DURATION_MS = 500;

// --- Pouring ------------------------------------------------------------------

/** Grains attempted per step while pouring sand or water. Some land on taken cells and are skipped. */
export const SPRAY_GRAINS_PER_STEP = 24;

/** How fast poured grains are already falling, in cells per step. */
export const POUR_FALL_SPEED = 3;

/** Radius, in cells, of the area each tool affects around the pour point. */
export const BRUSH_RADIUS: Readonly<Record<ToolKind, number>> = {
    sand: 4.5,
    water: 4.5,
    wall: 1.5,
    erase: 5,
};

// --- How grains move ----------------------------------------------------------

/** Fall speed gained per step while falling freely, in cells per step. */
export const GRAVITY = 0.4;

/** Fastest fall, in cells per step. */
export const MAX_FALL_SPEED = 6;

/** Furthest water flows sideways in one step. */
export const MAX_FLOW_CELLS = 4;

/** Furthest along a row water looks for a drop to spill over. */
export const FLOW_SIGHT_CELLS = 32;

/** Chance per step that sand resting on water swaps places with it. */
export const SINK_CHANCE = 0.35;

/** Consecutive steps a grain must fail to move before it falls asleep. */
export const STEPS_TO_SLEEP = 2;

// --- The starting scene -------------------------------------------------------

/** How deep the starting scene's ledges are, in cells. */
export const LEDGE_THICKNESS = 2;
