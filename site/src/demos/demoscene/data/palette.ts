// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

/**
 * The sixteen colours, as RGB, from Philip "Pepto" Timmermann's measurements
 * of the VIC-II's luma and chroma, the palette most emulators use. A colour
 * is a number 0-15 everywhere else in the demo; only the view's last step
 * turns it into RGB.
 */
export const PALETTE_RGB: readonly number[] = [
    0x000000, // 0  black
    0xffffff, // 1  white
    0x68372b, // 2  red
    0x70a4b2, // 3  cyan
    0x6f3d86, // 4  purple
    0x588d43, // 5  green
    0x352879, // 6  blue
    0xb8c76f, // 7  yellow
    0x6f4f25, // 8  orange
    0x433900, // 9  brown
    0x9a6759, // 10 light red
    0x444444, // 11 dark grey
    0x6c6c6c, // 12 grey
    0x9ad284, // 13 light green
    0x6c5eb5, // 14 light blue
    0x959595, // 15 light grey
];

/** Names for the colours the painters use by name. */
export const BLACK = 0;
export const WHITE = 1;
export const RED = 2;
export const CYAN = 3;
export const PURPLE = 4;
export const GREEN = 5;
export const BLUE = 6;
export const YELLOW = 7;
export const ORANGE = 8;
export const BROWN = 9;
export const LIGHT_RED = 10;
export const DARK_GREY = 11;
export const GREY = 12;
export const LIGHT_GREEN = 13;
export const LIGHT_BLUE = 14;
export const LIGHT_GREY = 15;

// ---------------------------------------------------------------------------
// Fades
// ---------------------------------------------------------------------------

/** How many steps the longest chain in the fade table takes to reach black. */
export const FADE_STEPS = 5;

/**
 * The fade table: `FADE_TABLE[level * 16 + colour]` is `colour` at a
 * brightness `level` from 0 (black) to `FADE_STEPS` (unchanged). Each step
 * goes to the next darker colour of a similar hue, as demo coders' tables
 * did, so a fade passes through the palette instead of dimming it.
 */
export const FADE_TABLE: Uint8Array = buildFadeTable();

/** A colour at a brightness from 0 (black) to 1 (unchanged), through the fade table. */
export function fadeColour(colour: number, brightness: number): number {
    const level = brightness >= 1 ? FADE_STEPS : brightness <= 0 ? 0 : Math.round(brightness * FADE_STEPS);
    return FADE_TABLE[level * 16 + colour];
}

// ---------------------------------------------------------------------------
// Ramps
// ---------------------------------------------------------------------------

/** The colour ramps raster bars and colour cycles are made of. */
export type RampKind = 'fire' | 'ice' | 'grass' | 'steel' | 'plum';

/** Each ramp dark to bright to dark, one colour per raster line. */
export const RAMPS: Readonly<Record<RampKind, Uint8Array>> = {
    fire: Uint8Array.of(BROWN, RED, ORANGE, LIGHT_RED, YELLOW, WHITE, YELLOW, LIGHT_RED, ORANGE, RED, BROWN),
    ice: Uint8Array.of(BLUE, PURPLE, LIGHT_BLUE, CYAN, LIGHT_GREY, WHITE, LIGHT_GREY, CYAN, LIGHT_BLUE, PURPLE, BLUE),
    grass: Uint8Array.of(BROWN, DARK_GREY, GREEN, LIGHT_GREEN, YELLOW, WHITE, YELLOW, LIGHT_GREEN, GREEN, DARK_GREY, BROWN),
    steel: Uint8Array.of(DARK_GREY, GREY, LIGHT_GREY, WHITE, LIGHT_GREY, GREY, DARK_GREY),
    plum: Uint8Array.of(BLUE, PURPLE, LIGHT_RED, PURPLE, BLUE),
};

/**
 * A long cycle through bright colours and back via dark ones, for colour
 * washes and the plasma: neighbouring entries are always close in brightness.
 */
export const COLOUR_CYCLE: Uint8Array = Uint8Array.of(
    BLUE, PURPLE, LIGHT_BLUE, CYAN, LIGHT_GREY, WHITE, YELLOW, LIGHT_RED, ORANGE, RED,
    BROWN, DARK_GREY, GREEN, LIGHT_GREEN, YELLOW, WHITE, LIGHT_GREY, GREY, DARK_GREY, BLUE,
);

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function buildFadeTable(): Uint8Array {
    const darker = darkerColours();
    const table = new Uint8Array((FADE_STEPS + 1) * 16);
    for (let colour = 0; colour < 16; colour++) {
        let faded = colour;
        for (let level = FADE_STEPS; level >= 0; level--) {
            table[level * 16 + colour] = faded;
            faded = darker[faded];
        }
    }
    return table;
}

/**
 * Each colour's next darker colour: greys to black; warm, cool and green
 * colours along their own chains. A function, so it is hoisted above
 * `FADE_TABLE`'s initialiser.
 */
function darkerColours(): readonly number[] {
    return [
        BLACK, //      black
        LIGHT_GREY, // white
        BROWN, //      red
        LIGHT_BLUE, // cyan
        BLUE, //       purple
        DARK_GREY, //  green
        BLACK, //      blue
        LIGHT_RED, //  yellow
        RED, //        orange
        BLACK, //      brown
        ORANGE, //     light red
        BLACK, //      dark grey
        DARK_GREY, //  grey
        GREEN, //      light green
        PURPLE, //     light blue
        GREY, //       light grey
    ];
}
