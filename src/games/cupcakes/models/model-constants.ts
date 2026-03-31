import type { StepDef } from '#common';

/** Duration of a swap animation in milliseconds. */
export const SWAP_DURATION_MS = 200;

/** Duration of the match fade-out in milliseconds. */
export const MATCH_FADE_MS = 250;

/** Speed at which cupcakes fall in rows per second. */
export const FALL_SPEED = 12;

/** Points per cupcake matched in a group. */
export const POINTS_PER_CUPCAKE = 10;

/** Bonus multiplier for each cascade step beyond the first. */
export const CASCADE_MULTIPLIER = 1.5;

/**
 * Overlapping effect steps that play during a match sequence.
 *
 * ```
 * Time (ms):  0        100       200       250       350       500
 *             |---------|---------|---------|---------|---------|
 *  fade:      [=====================]                              0-250ms
 *  shake:        [=================]                               50-250ms
 *  dust:            [==========================]                   100-350ms
 *  popup:               [================================]         150-500ms
 * ```
 */
export const MATCH_EFFECT_STEPS: readonly StepDef[] = [
    { name: 'fade',  startMs: 0,   durationMs: 250 },
    { name: 'shake', startMs: 50,  durationMs: 200 },
    { name: 'dust',  startMs: 100, durationMs: 250 },
    { name: 'popup', startMs: 150, durationMs: 350 },
];
