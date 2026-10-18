/**
 * Generate the site's pixel font, a web font of the site's pixel glyphs
 * (`#pixel-glyphs`), which the nav sets the site's name in. Each of the
 * three sites keeps its own copy, as it keeps its own copy of the nav: the
 * Arcade, the playground and the docs.
 *
 * Run:  npm run generate-pixel-font
 *
 * Run it again whenever a glyph changes. A test fails while the font
 * committed is not the one the glyphs make.
 */

import { writeFileSync } from 'node:fs';
import { PIXEL_FONT_OPTIONS, PIXEL_FONT_PATHS } from './pixel-font-options.ts';
import { buildPixelFont, toWoff } from './pixel-font.ts';

const woff = toWoff(buildPixelFont(PIXEL_FONT_OPTIONS));
for (const path of PIXEL_FONT_PATHS) {
    writeFileSync(path, woff);
    console.log(`Wrote ${path} (${woff.length} bytes)`);
}
