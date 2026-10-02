import { PERFMON_HEIGHT, PERFMON_INFO_HEIGHT } from '#common';

/**
 * Sizes and positions for the demo's views, in canvas pixels. The tank is
 * the same size on screen whatever its size in cells (`TANK_SIZES`, in
 * `model-constants.ts`); a tank of more cells draws each one smaller. The
 * canvas is a fixed size that the gallery scales to fit the window, so one
 * portrait layout serves phones and desktops alike.
 */

export const MARGIN = 12;
export const TANK_X = MARGIN;
export const TANK_Y = MARGIN;
/** The tank's size on screen. Every tank size in cells divides these evenly, so cells are whole pixels. */
export const TANK_WIDTH = 456;
export const TANK_HEIGHT = 540;

export const TOOLBAR_X = MARGIN;
export const TOOLBAR_Y = TANK_Y + TANK_HEIGHT + MARGIN;
export const TOOLBAR_WIDTH = TANK_WIDTH;
export const BUTTON_SIZE = 52;
export const BUTTON_GAP = 8;

/** The row of implementation switches, below the buttons. */
export const VARIANTS_Y = BUTTON_SIZE + 12;
export const VARIANTS_HEIGHT = 44;
export const SEGMENT_HEIGHT = 26;

export const STATS_Y = VARIANTS_Y + VARIANTS_HEIGHT + 10;
export const STATS_HEIGHT = PERFMON_HEIGHT;

// The perfmon's info card rises from the panel's bottom, at the toolbar's
// bottom, and the tank is drawn in front of the toolbar: a taller card would
// be hidden behind it.
if (PERFMON_INFO_HEIGHT > STATS_Y + STATS_HEIGHT) {
    throw new Error(
        `The perfmon's info card (${PERFMON_INFO_HEIGHT}px) is taller than the toolbar `
        + `(${STATS_Y + STATS_HEIGHT}px), so the tank would cover its top.`,
    );
}

export const SCREEN_WIDTH = TANK_WIDTH + MARGIN * 2;
export const SCREEN_HEIGHT = TOOLBAR_Y + STATS_Y + STATS_HEIGHT + MARGIN;
