import { FIELD_COLS, FIELD_ROWS } from '../data';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** One cell of the meadow, in pixels. */
export const CELL_SIZE = 8;

/** The HUD's bar across the top, in pixels. */
export const HUD_HEIGHT = 24;

/** The bare earth round the meadow's other three sides, in pixels. */
export const MARGIN = 8;

/** Where the meadow's top left corner is on the screen. */
export const FIELD_X = MARGIN;
export const FIELD_Y = HUD_HEIGHT;

/** The meadow's size, in pixels. */
export const FIELD_WIDTH = FIELD_COLS * CELL_SIZE;
export const FIELD_HEIGHT = FIELD_ROWS * CELL_SIZE;

/** The whole play area, in pixels: the HUD, the meadow and the earth round it. */
export const SCREEN_WIDTH = FIELD_WIDTH + MARGIN * 2;
export const SCREEN_HEIGHT = HUD_HEIGHT + FIELD_HEIGHT + MARGIN;

/** The font of the HUD and the points. */
export const HUD_FONT = 'monospace';

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

/** The game's palette: an earthy farm in late summer. */
export const COLOURS = {
    earth: 0x3b2a19,
    hud: 0x24180d,
    hudText: 0xf3e6c4,
    hudDim: 0x9c8a66,

    straw: 0xc9ae62,
    strawDark: 0xa48a45,
    strawLight: 0xe3cd86,

    grass: 0x5d9b38,
    grassStripe: 0x6aaa40,
    grassDark: 0x4a8430,
    flowerWhite: 0xfaf6ea,
    flowerYellow: 0xffd84a,
    flowerPink: 0xf08ab0,

    pond: 0x3c7db5,
    pondLight: 0x74b0dc,
    pondEdge: 0xb59e68,
    rock: 0x8b857c,
    rockLight: 0xb2ada4,
    rockDark: 0x5f5a53,
    rockGround: 0x6a5c4a,

    rail: 0x6b4423,
    post: 0x3e2814,
    postTop: 0x8d5f35,
    oldRail: 0x7d6a45,

    wire: 0xf4f1e6,
    wireShadow: 0x3b2a19,
    slack: 0xe0502a,

    skin: 0xf1c27d,
    shirt: 0xc0392b,
    overalls: 0x3b5ca8,
    hat: 0xe8c35a,
    hatBand: 0x8d5f35,
    boot: 0x2b1d10,
    reel: 0x9a9a9a,

    dust: 0xb89a6a,
    dustDark: 0x8c7350,
    dustLight: 0xf0dfb8,
    devilEdge: 0x5a4632,

    beetle: 0x23283f,
    beetleShine: 0x3fa37a,
    egg: 0xf3ecd8,

    wool: 0xf7f4ea,
    woolShade: 0xd6cfbd,
    sheepFace: 0x2a2622,
    heart: 0xf0507e,
    heartEdge: 0x7a1838,
} as const;
