import { PERFMON_HEIGHT } from '#common';
import { TANK_COLS, TANK_ROWS } from './model-constants';

/**
 * Sizes and positions for the demo's views, in canvas pixels. The tank's size
 * in cells is the model's (`model-constants.ts`); these turn it into pixels.
 * The canvas is a fixed size that the gallery scales to fit the window, so
 * one portrait layout serves phones and desktops alike.
 */

/** Pixels per cell. With the tank's size in cells, sets the size of the canvas. */
export const CELL_SIZE = 3;

export const MARGIN = 12;
export const TANK_X = MARGIN;
export const TANK_Y = MARGIN;
export const TANK_WIDTH = TANK_COLS * CELL_SIZE;
export const TANK_HEIGHT = TANK_ROWS * CELL_SIZE;

export const TOOLBAR_X = MARGIN;
export const TOOLBAR_Y = TANK_Y + TANK_HEIGHT + MARGIN;
export const TOOLBAR_WIDTH = TANK_WIDTH;
export const BUTTON_SIZE = 52;
export const BUTTON_GAP = 8;
export const STATS_Y = BUTTON_SIZE + 10;
export const STATS_HEIGHT = PERFMON_HEIGHT;

export const SCREEN_WIDTH = TANK_WIDTH + MARGIN * 2;
export const SCREEN_HEIGHT = TOOLBAR_Y + STATS_Y + STATS_HEIGHT + MARGIN;
