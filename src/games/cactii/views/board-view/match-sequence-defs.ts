import type { StepDef } from '#common';

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

/**
 * Overlapping effect steps for the match sequence. Visual intensity scales
 * with cascade step - core effects (flash, fade, dust, popup) are visible
 * from cascade 1, while later effects (stars, fireworks, banner) only
 * activate at higher cascades.
 *
 * ```
 * Time (ms):   0       200     400     600     800     1000
 *              |       |       |       |       |       |
 * flash:       [====]                                        0-117
 * fade:        [================]                            0-433
 * zoom:        [=======================================]     0-1000
 * shake:          [===================]                      67-567
 * bannerIn:          [======]                                150-317
 * fwLaunch:          [=============]                         150-500
 * dust:              [===================]                   150-650
 * popup:                [=====================]              217-784
 * stars:                  [===============================]  283-1067
 * bannerHold:                [==========]                    317-600
 * fwBurst:                    [================]             350-783
 * bannerOut:                                   [========]    600-817
 * ```
 */
export const MATCH_EFFECT_STEPS = [
    { name: 'flash',          startMs: 0,    durationMs: 117 },
    { name: 'fade',           startMs: 0,    durationMs: 433 },
    { name: 'shake',          startMs: 67,   durationMs: 500 },
    { name: 'dust',           startMs: 150,  durationMs: 500 },
    { name: 'popup',          startMs: 217,  durationMs: 567 },
    { name: 'stars',          startMs: 283,  durationMs: 783 },
    { name: 'zoom',           startMs: 0,    durationMs: 1000 },
    { name: 'fireworkLaunch', startMs: 150,  durationMs: 350 },
    { name: 'fireworkBurst',  startMs: 350,  durationMs: 433 },
    { name: 'bannerIn',       startMs: 150,  durationMs: 167 },
    { name: 'bannerHold',     startMs: 317,  durationMs: 283 },
    { name: 'bannerOut',      startMs: 600,  durationMs: 217 },
] as const satisfies readonly StepDef[];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Union of all step names in the match effect sequence. */
export type MatchStepName = (typeof MATCH_EFFECT_STEPS)[number]['name'];
