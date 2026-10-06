// ---------------------------------------------------------------------------
// Layout, in pixels of the Pixi canvas's design size
// ---------------------------------------------------------------------------

export const SCREEN_WIDTH = 960;
export const SCREEN_HEIGHT = 540;

/** One cell of the window: a symbol and the space round it. */
export const CELL_SIZE = 104;
/** The space between reels. */
export const REEL_GAP = 8;
/** How much of its cell a symbol's picture fills. */
export const SYMBOL_SCALE = 0.84;

export const REEL_COUNT = 5;
export const WINDOW_WIDTH = REEL_COUNT * CELL_SIZE + (REEL_COUNT - 1) * REEL_GAP;
export const WINDOW_X = (SCREEN_WIDTH - WINDOW_WIDTH) / 2;
export const WINDOW_Y = 108;

/** The window's frame, round the reels. */
export const FRAME_PADDING = 16;

/** Where the spin button sits, right of the window. */
export const BUTTON_X = 870;
export const BUTTON_Y = 264;
export const BUTTON_RADIUS = 56;

/** The meters, in a row under the window. */
export const METERS_Y = 464;
export const METER_HEIGHT = 58;

/** The centre of a cell of the window, from the screen's top left. */
export function cellCenterX(reel: number): number {
    return WINDOW_X + reel * (CELL_SIZE + REEL_GAP) + CELL_SIZE / 2;
}

export function cellCenterY(row: number): number {
    return WINDOW_Y + row * CELL_SIZE + CELL_SIZE / 2;
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

// Flat, bright, a few tones each, like the symbols.

export const BACKDROP = '#2a1766';
export const BACKDROP_DECAL = '#35208a';
export const FRAME = '#ff4f8b';
export const FRAME_SHADE = '#c72e68';
export const WINDOW_BACKING = '#ffd6e6';
export const REEL_FACE = '#fff7ea';
export const BULB_ON = '#ffe45c';
export const BULB_OFF = '#5b3db5';
export const METER_FACE = '#1b0f47';
export const METER_LABEL = '#b9a8ff';
export const METER_VALUE = '#ffe45c';
export const DIM = '#1b0f47';
export const SHADOW = '#140a38';
export const WHITE = '#ffffff';

export const FONT_FAMILY = '"Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';
