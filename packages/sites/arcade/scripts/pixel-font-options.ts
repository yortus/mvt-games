import { FIRST_GLYPH_CODE, GLYPH_BASELINE_ROWS, GLYPH_COLUMNS, GLYPH_ROWS, PIXEL_GLYPHS } from '#pixel-glyphs';
import type { PixelFontOptions } from './pixel-font.ts';
import { join } from 'node:path';

/** The site's pixel font: its name in CSS, and the glyphs it is made of. The generator and its test share these. */
export const PIXEL_FONT_OPTIONS: PixelFontOptions = {
    familyName: 'MVT Pixel',
    glyphs: PIXEL_GLYPHS,
    firstCode: FIRST_GLYPH_CODE,
    columns: GLYPH_COLUMNS,
    baselineRows: GLYPH_BASELINE_ROWS,
    rows: GLYPH_ROWS,
};

const SITES = join(import.meta.dirname, '..', '..');

/** Where each site keeps its copy of the font, beside its copy of the nav's stylesheet. */
export const PIXEL_FONT_PATHS: readonly string[] = [
    join(SITES, 'arcade', 'src', 'shared', 'mvt-pixel.woff'),
    join(SITES, 'playground', 'src', 'mvt-pixel.woff'),
    join(SITES, 'docs', '.vitepress', 'theme', 'mvt-pixel.woff'),
];
