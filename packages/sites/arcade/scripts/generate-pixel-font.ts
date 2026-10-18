/**
 * Generate the site's pixel font, a web font of the site's pixel glyphs
 * (`#pixel-glyphs`), which the nav sets its text in.
 *
 * Run:  npm run generate-pixel-font
 *
 * Run it again whenever a glyph changes. A test fails while the font
 * committed is not the one the glyphs make.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PIXEL_FONT_OPTIONS } from './pixel-font-options.ts';
import { buildPixelFont, toWoff } from './pixel-font.ts';

const OUT_PATH = join(import.meta.dirname, '..', 'src', 'shared', 'mvt-pixel.woff');

const woff = toWoff(buildPixelFont(PIXEL_FONT_OPTIONS));
writeFileSync(OUT_PATH, woff);
console.log(`Wrote ${OUT_PATH} (${woff.length} bytes)`);
