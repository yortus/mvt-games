import { FIRST_GLYPH_CODE, GLYPH_BASELINE_ROWS, GLYPH_COLUMNS, GLYPH_ROWS, PIXEL_GLYPHS } from '#pixel-glyphs';
import type { PixelFontOptions } from './pixel-font.ts';

/** The site's pixel font: its name in CSS, and the glyphs it is made of. The generator and its test share these. */
export const PIXEL_FONT_OPTIONS: PixelFontOptions = {
    familyName: 'MVT Pixel',
    glyphs: PIXEL_GLYPHS,
    firstCode: FIRST_GLYPH_CODE,
    columns: GLYPH_COLUMNS,
    baselineRows: GLYPH_BASELINE_ROWS,
    rows: GLYPH_ROWS,
};
