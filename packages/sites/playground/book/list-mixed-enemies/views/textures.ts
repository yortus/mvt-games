import { BufferImageSource, Texture } from 'pixi.js';

// ---------------------------------------------------------------------------
// Art
// ---------------------------------------------------------------------------

// The textures are made as this module loads, so what they're made from
// comes first.

/** How many screen pixels across each art pixel is. */
const PIXEL_SIZE = 3;

/** The saucer, one letter for each art pixel. A dot is see-through. */
const SAUCER_ROWS: readonly string[] = [
    '.....ccccc.....',
    '....cccwccc....',
    '...ccccccccc...',
    '.ggggggggggggg.',
    'gyggyggyggyggyg',
    '.ggggggggggggg.',
    '...g.......g...',
];

/** The colour of each letter in the saucer's rows. */
const SAUCER_COLORS: Readonly<Record<string, number | undefined>> = {
    c: 0x9fe8ff,
    w: 0xffffff,
    g: 0x8a93b0,
    y: 0xffe08a,
};

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

/** The saucer, drawn as pixel art. */
export const saucerTexture = createPixelTexture({
    cols: SAUCER_ROWS[0].length,
    rows: SAUCER_ROWS.length,
    colorAt: (col, row) => SAUCER_COLORS[SAUCER_ROWS[row][col]],
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
