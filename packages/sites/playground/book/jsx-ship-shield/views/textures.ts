import { BufferImageSource, Texture } from 'pixi.js';

// ---------------------------------------------------------------------------
// Art
// ---------------------------------------------------------------------------

// The textures are made as this module loads, so what they're made from
// comes first.

/** How many screen pixels across each art pixel is. */
const PIXEL_SIZE = 3;

/** The ship, pointing up, one letter for each art pixel. A dot is see-through. */
const SHIP_ROWS: readonly string[] = [
    '......w......',
    '.....www.....',
    '.....wcw.....',
    '....wwcww....',
    '....wcccw....',
    '...wwcccww...',
    '..wwwwcwwww..',
    '.wwwwwwwwwww.',
    'wwrwwwwwwwrww',
    'ww..wwwww..ww',
    'w....r.r....w',
];

/** The colour of each letter in the ship's rows. */
const SHIP_COLORS: Readonly<Record<string, number | undefined>> = {
    w: 0xdfe6ff,
    c: 0x4fc3ff,
    r: 0xff7a45,
};

/** How many art pixels across the shield is. */
const SHIELD_SIZE = 25;

/** How many arcs the shield's outer ring is broken into. */
const SHIELD_ARCS = 3;

/** How much of the outer ring is gaps between the arcs, from 0 to 1. */
const SHIELD_GAPS = 0.25;

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

/** The ship, pointing up, drawn as pixel art. */
export const shipTexture = createPixelTexture({
    cols: SHIP_ROWS[0].length,
    rows: SHIP_ROWS.length,
    colorAt: (col, row) => SHIP_COLORS[SHIP_ROWS[row][col]],
});

/**
 * The shield: a ring broken into arcs, with a speckled band inside it, big
 * enough to hold the ship. The gaps show the shield turning.
 */
export const shieldTexture = createPixelTexture({
    cols: SHIELD_SIZE,
    rows: SHIELD_SIZE,
    colorAt: (col, row) => {
        const middle = (SHIELD_SIZE - 1) / 2;
        const distance = Math.hypot(col - middle, row - middle);
        if (distance > middle - 0.5) return undefined;
        if (distance > middle - 2.5) {
            // How far round the ring the pixel is, in arcs
            const arcs = ((Math.atan2(row - middle, col - middle) + Math.PI) / (Math.PI * 2)) * SHIELD_ARCS;
            return arcs % 1 < SHIELD_GAPS ? undefined : 0x9fe8ff;
        }
        if (distance > middle - 5.5 && (col + row) % 2 === 0) return 0x4fb8ff;
        return undefined;
    },
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface PixelTextureOptions {
    /** How many art pixels across and down. */
    readonly cols: number;
    readonly rows: number;
    /** The colour of the art pixel at a column and row, or undefined for none. */
    readonly colorAt: (col: number, row: number) => number | undefined;
}

/**
 * Creates a texture from art pixels, each drawn as a square of screen
 * pixels, so the texture looks like pixel art at its own size.
 */
function createPixelTexture({ cols, rows, colorAt }: PixelTextureOptions): Texture {
    const width = cols * PIXEL_SIZE;
    const height = rows * PIXEL_SIZE;
    const bytes = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = colorAt(Math.floor(x / PIXEL_SIZE), Math.floor(y / PIXEL_SIZE));
            if (color === undefined) continue;
            const i = (y * width + x) * 4;
            bytes[i] = (color >> 16) & 0xff;
            bytes[i + 1] = (color >> 8) & 0xff;
            bytes[i + 2] = color & 0xff;
            bytes[i + 3] = 0xff;
        }
    }
    const source = new BufferImageSource({ resource: bytes, width, height, scaleMode: 'nearest' });
    return new Texture({ source });
}
