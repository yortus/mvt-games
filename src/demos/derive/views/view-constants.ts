// ---------------------------------------------------------------------------
// Shared view styling
// ---------------------------------------------------------------------------

export const FONT = 'monospace';

export const PANEL_BG = 0x161a22;
export const PANEL_BORDER = 0x2c3444;
export const PANEL_FLASH = 0xffd36e;
export const PANEL_RADIUS = 8;
export const PANEL_PAD = 12;

export const TEXT_MAIN = 0xdfe6f0;
export const TEXT_DIM = 0x8592a6;

export const TITLE_SIZE = 13;
export const LABEL_SIZE = 11;

export const BUTTON_BG = 0x263042;
export const BUTTON_BG_HOVER = 0x334056;
export const BUTTON_BG_ACTIVE = 0x3d5a86;

/** Milliseconds a panel stays highlighted after a recompute. */
export const FLASH_MS = 420;

export const TEXT_RESOLUTION = (typeof globalThis !== 'undefined' && 'devicePixelRatio' in globalThis)
    ? globalThis.devicePixelRatio
    : 1;
