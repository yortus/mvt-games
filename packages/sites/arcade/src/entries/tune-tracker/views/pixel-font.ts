import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { FIRST_GLYPH_CODE, GLYPH_COLUMNS, GLYPH_ROWS, LAST_GLYPH_CODE } from '#pixel-glyphs';

// The Tune Tracker's pixel font, cut from the sheet that
// `scripts/generate-tune-tracker-textures.ts` draws, and the rows of glyphs
// its views write text into.

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The font: a texture for each glyph, by its character code. */
export interface PixelFont {
    /** Each glyph's texture, by character code, from 0 to `LOOP_GLYPH`. A code with no glyph has the space's. */
    readonly glyphs: readonly Texture[];
}

/**
 * A row of glyphs, one sprite a column, which a view writes text into. A
 * write changes only the sprites' textures and tints, so writing allocates
 * nothing.
 */
export interface GlyphRow {
    /** The sprites, a glyph's width apart, from the row's left edge. */
    readonly container: Container;
    /** How many columns it has. */
    readonly length: number;
    /** Writes `text` in `color` from `column`. What does not fit is left out. */
    write: (text: string, color: number, column: number) => void;
    /** Writes one glyph, by its character code, in `color` at `column`. */
    writeGlyph: (code: number, color: number, column: number) => void;
    /** Writes a whole number of 0 or more as `digits` digits in base `radix`, with leading zeros, such as `0F` for 15 in hex. */
    writeNumber: (value: number, digits: number, radix: number, color: number, column: number) => void;
    /** Blanks the columns from `column` to the end. */
    clearFrom: (column: number) => void;
}

/** Each glyph's cell, in pixels: the width the text advances by, and the height a line takes. */
export const GLYPH_WIDTH = GLYPH_COLUMNS + 1;
export const GLYPH_HEIGHT = GLYPH_ROWS + 1;

/** The tracker's own symbols, after `~`: a play triangle, a stop square, a column's rule, a blank's dot and the loop's arrow. */
export const PLAY_GLYPH = LAST_GLYPH_CODE + 1;
export const STOP_GLYPH = LAST_GLYPH_CODE + 2;
export const RULE_GLYPH = LAST_GLYPH_CODE + 3;
export const DOT_GLYPH = LAST_GLYPH_CODE + 4;
export const LOOP_GLYPH = LAST_GLYPH_CODE + 5;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PixelFontOptions {
    /** The font's sheet: glyphs in cells of `GLYPH_WIDTH` by `GLYPH_HEIGHT`, sixteen to a row, from the space. */
    readonly sheet: Texture;
}

export interface GlyphRowOptions {
    readonly font: PixelFont;
    /** How many columns it has. */
    readonly length: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Cuts the font's sheet into its glyphs. Do it once, as the entry starts: each glyph is a texture of its own. */
export function createPixelFont(options: PixelFontOptions): PixelFont {
    const { sheet } = options;
    const glyphs: Texture[] = [];
    let space = Texture.EMPTY;
    for (let code = FIRST_GLYPH_CODE; code <= LOOP_GLYPH; code++) {
        const index = code - FIRST_GLYPH_CODE;
        const frame = new Rectangle(
            sheet.frame.x + (index % SHEET_COLUMNS) * GLYPH_WIDTH,
            sheet.frame.y + Math.floor(index / SHEET_COLUMNS) * GLYPH_HEIGHT,
            GLYPH_WIDTH,
            GLYPH_HEIGHT,
        );
        glyphs[code] = new Texture({ source: sheet.source, frame });
        if (code === FIRST_GLYPH_CODE) space = glyphs[code];
    }
    for (let code = 0; code < FIRST_GLYPH_CODE; code++) glyphs[code] = space;
    return { glyphs };
}

/** Creates a row of `length` blank glyphs. */
export function createGlyphRow(options: GlyphRowOptions): GlyphRow {
    const { font, length } = options;
    const { glyphs } = font;
    const space = glyphs[FIRST_GLYPH_CODE];
    const container = new Container();
    const sprites: Sprite[] = [];
    for (let column = 0; column < length; column++) {
        const sprite = new Sprite(space);
        sprite.x = column * GLYPH_WIDTH;
        sprites.push(sprite);
        container.addChild(sprite);
    }

    const row: GlyphRow = {
        container,
        length,
        write(text, color, column) {
            const end = Math.min(length, column + text.length);
            for (let i = Math.max(0, column); i < end; i++) row.writeGlyph(text.charCodeAt(i - column), color, i);
        },
        writeGlyph(code, color, column) {
            if (column < 0 || column >= length) return;
            const sprite = sprites[column];
            sprite.texture = code < glyphs.length ? glyphs[code] : space;
            sprite.tint = color;
        },
        writeNumber(value, digits, radix, color, column) {
            let rest = Math.max(0, Math.floor(value));
            for (let i = digits - 1; i >= 0; i--) {
                const digit = rest % radix;
                row.writeGlyph(digit < 10 ? ZERO + digit : LETTER_A + digit - 10, color, column + i);
                rest = Math.floor(rest / radix);
            }
        },
        clearFrom(column) {
            for (let i = Math.max(0, column); i < length; i++) sprites[i].texture = space;
        },
    };
    return row;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SHEET_COLUMNS = 16;
const ZERO = 48;
const LETTER_A = 65;
