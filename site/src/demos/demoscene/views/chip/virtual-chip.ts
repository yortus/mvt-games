import { FONT } from '../../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A virtual video chip, shaped like the C64's VIC-II: its memory and
 * registers, with the original's layout, and so with its limits. Painters
 * write it; `composeFrame` turns it into a frame of colours, line by line,
 * by the chip's rules.
 *
 * The limits are in the shapes of the data: a character cell has one byte
 * of colour memory, so a cell of hires text has one colour on the
 * background; a sprite pool can hold 64 sprites, but only eight hardware
 * slots exist, so no line can show more than eight. Getting past the limits
 * means the tricks demo coders used: rewriting registers line by line,
 * redefining characters every frame, reusing sprites further down.
 *
 * Not an emulator: there is no CPU and no timing. Registers can change on
 * every line, which the real chip allowed only for a few at a time.
 *
 * Lines are numbered 0-271 down the whole visible frame, borders included.
 * The display window, 320 x 200, starts at `DISPLAY_LEFT`, `DISPLAY_TOP`.
 */
export interface VirtualChip {
    /** Screen memory: a byte per character cell, 40 x 25. A character code in text modes, two colours in bitmap modes. */
    readonly screen: Uint8Array;
    /** Colour memory: a colour (0-15) per character cell. */
    readonly colour: Uint8Array;
    /** The character set: 256 characters of 8 bytes, top row first, high bit leftmost. */
    readonly charset: Uint8Array;
    /** Bitmap memory: 8000 bytes, laid out cell by cell as the chip reads it (see `bitmapIndex`). */
    readonly bitmap: Uint8Array;

    /** Registers that can change on every line, indexed by line (0-271). */
    readonly border: Uint8Array;
    readonly background: Uint8Array;
    /** The two colours shared by every multicolour text cell. */
    readonly multicolour1: Uint8Array;
    readonly multicolour2: Uint8Array;
    /** Each line's display mode, as a `DisplayModeKind`'s code; set it with `setMode`. */
    readonly mode: Uint8Array;
    /** How far right each line of the display is shifted, in pixels; a negative shift is left. */
    readonly xOffset: Int16Array;
    /**
     * Which line of the display (0-199) each line shows, or -1 for a blank
     * line of background. Normally a line's own place in the window; pushing
     * it down inserts blank lines, the FLD trick.
     */
    readonly sourceLine: Int16Array;

    /** The sprite pool. Sprite `i`'s position is its top left, in frame pixels. */
    readonly spriteX: Int16Array;
    readonly spriteY: Int16Array;
    /** Which shape in `spriteShapes` the sprite shows. */
    readonly spriteShape: Uint8Array;
    readonly spriteColour: Uint8Array;
    /** Flags, each 0 or 1. Behind: the sprite shows only where the display shows background. */
    readonly spriteIsMulticolour: Uint8Array;
    readonly spriteIsExpandedX: Uint8Array;
    readonly spriteIsExpandedY: Uint8Array;
    readonly spriteIsBehind: Uint8Array;
    /** How many sprites are in the pool this frame. */
    readonly spriteCount: number;
    /** The colours shared by every multicolour sprite. */
    spriteMulticolour1: number;
    spriteMulticolour2: number;
    /** Sprite shapes: 64 bytes each (63 used), 24 x 21 pixels, three bytes a row. */
    readonly spriteShapes: Uint8Array;

    /** Whether the top and bottom borders are opened, so sprites show in them, over the background colour. */
    hasOpenBorders: boolean;

    /** Set by `composeFrame`: each sprite's hardware slot (0 frontmost, 7 backmost), or -1 if it found none. */
    readonly spriteSlot: Int8Array;
    /** Set by `composeFrame`: how many sprites found no slot this frame. */
    droppedSpriteCount: number;
    /** Set by `composeFrame`: how many sprites each line showed. */
    readonly spritesOnLine: Uint8Array;

    /** Adds a sprite to the pool, with every flag off, and returns its index. */
    addSprite: (x: number, y: number, shape: number, colour: number) => number;
    /** Sets the display mode of lines `fromLine` up to but not including `toLine`. */
    setMode: (fromLine: number, toLine: number, mode: DisplayModeKind) => void;
    /** Back to a blank frame: text mode, all black, no sprites, the font in the character set. */
    reset: () => void;
}

/** The chip's display modes: text or bitmap, each in hires or multicolour. */
export type DisplayModeKind = 'text' | 'multicolour-text' | 'bitmap' | 'multicolour-bitmap';

/** The whole visible frame, borders included: the PAL machine's 384 x 272. */
export const FRAME_WIDTH = 384;
export const FRAME_HEIGHT = 272;

/** The display window inside the borders. */
export const DISPLAY_LEFT = 32;
export const DISPLAY_TOP = 35;
export const DISPLAY_WIDTH = 320;
export const DISPLAY_HEIGHT = 200;
export const COLUMNS = 40;
export const ROWS = 25;

/** The sprite pool's size, and how many the chip can show on one line. */
export const SPRITE_POOL_SIZE = 64;
export const HARDWARE_SPRITES = 8;
export const SPRITE_WIDTH = 24;
export const SPRITE_HEIGHT = 21;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createVirtualChip(): VirtualChip {
    let spriteCount = 0;

    const chip: VirtualChip = {
        screen: new Uint8Array(COLUMNS * ROWS),
        colour: new Uint8Array(COLUMNS * ROWS),
        charset: new Uint8Array(256 * 8),
        bitmap: new Uint8Array(8000),
        border: new Uint8Array(FRAME_HEIGHT),
        background: new Uint8Array(FRAME_HEIGHT),
        multicolour1: new Uint8Array(FRAME_HEIGHT),
        multicolour2: new Uint8Array(FRAME_HEIGHT),
        mode: new Uint8Array(FRAME_HEIGHT),
        xOffset: new Int16Array(FRAME_HEIGHT),
        sourceLine: new Int16Array(FRAME_HEIGHT),
        spriteX: new Int16Array(SPRITE_POOL_SIZE),
        spriteY: new Int16Array(SPRITE_POOL_SIZE),
        spriteShape: new Uint8Array(SPRITE_POOL_SIZE),
        spriteColour: new Uint8Array(SPRITE_POOL_SIZE),
        spriteIsMulticolour: new Uint8Array(SPRITE_POOL_SIZE),
        spriteIsExpandedX: new Uint8Array(SPRITE_POOL_SIZE),
        spriteIsExpandedY: new Uint8Array(SPRITE_POOL_SIZE),
        spriteIsBehind: new Uint8Array(SPRITE_POOL_SIZE),
        get spriteCount() { return spriteCount; },
        spriteMulticolour1: 0,
        spriteMulticolour2: 0,
        spriteShapes: new Uint8Array(64 * 64),
        hasOpenBorders: false,
        spriteSlot: new Int8Array(SPRITE_POOL_SIZE),
        droppedSpriteCount: 0,
        spritesOnLine: new Uint8Array(FRAME_HEIGHT),

        addSprite(x, y, shape, colour) {
            if (spriteCount >= SPRITE_POOL_SIZE) throw new Error('the sprite pool is full');
            const index = spriteCount++;
            chip.spriteX[index] = x;
            chip.spriteY[index] = y;
            chip.spriteShape[index] = shape;
            chip.spriteColour[index] = colour;
            chip.spriteIsMulticolour[index] = 0;
            chip.spriteIsExpandedX[index] = 0;
            chip.spriteIsExpandedY[index] = 0;
            chip.spriteIsBehind[index] = 0;
            return index;
        },
        setMode(fromLine, toLine, mode) {
            chip.mode.fill(MODE_CODES[mode], Math.max(0, fromLine), Math.min(FRAME_HEIGHT, toLine));
        },
        reset() {
            chip.screen.fill(SPACE);
            chip.colour.fill(0);
            chip.charset.fill(0);
            chip.charset.set(FONT);
            chip.bitmap.fill(0);
            chip.border.fill(0);
            chip.background.fill(0);
            chip.multicolour1.fill(0);
            chip.multicolour2.fill(0);
            chip.mode.fill(0);
            chip.xOffset.fill(0);
            chip.sourceLine.set(NORMAL_SOURCE_LINES);
            chip.spriteShapes.fill(0);
            spriteCount = 0;
            chip.spriteMulticolour1 = 0;
            chip.spriteMulticolour2 = 0;
            chip.hasOpenBorders = false;
            chip.droppedSpriteCount = 0;
        },
    };

    chip.reset();
    return chip;
}

/** The code `chip.mode` stores for each display mode. */
export const MODE_CODES: Readonly<Record<DisplayModeKind, number>> = {
    'text': 0,
    'multicolour-text': 1,
    'bitmap': 2,
    'multicolour-bitmap': 3,
};

/**
 * Where bitmap memory holds the byte for display pixel row `y` (0-199) and
 * byte column `byteCol` (0-39, eight hires pixels or four multicolour ones
 * each): the chip reads bitmaps a character cell at a time, eight bytes per
 * cell, top to bottom.
 */
export function bitmapIndex(byteCol: number, y: number): number {
    return (y >> 3) * 320 + byteCol * 8 + (y & 7);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SPACE = 32;

/** Each line's own place in the display window, or -1 in the borders. */
const NORMAL_SOURCE_LINES = buildNormalSourceLines();

function buildNormalSourceLines(): Int16Array {
    const lines = new Int16Array(FRAME_HEIGHT);
    for (let line = 0; line < FRAME_HEIGHT; line++) {
        const y = line - DISPLAY_TOP;
        lines[line] = y >= 0 && y < DISPLAY_HEIGHT ? y : -1;
    }
    return lines;
}
