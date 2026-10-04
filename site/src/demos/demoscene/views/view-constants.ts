import { FRAME_HEIGHT, FRAME_WIDTH } from './chip';

/** Each of the chip's pixels is shown as a square this many canvas pixels across. */
export const PIXEL_SCALE = 2;

/** The canvas: the chip's whole frame, borders included, at `PIXEL_SCALE`. */
export const SCREEN_WIDTH = FRAME_WIDTH * PIXEL_SCALE;
export const SCREEN_HEIGHT = FRAME_HEIGHT * PIXEL_SCALE;
