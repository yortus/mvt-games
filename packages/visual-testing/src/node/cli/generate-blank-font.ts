/**
 * Writes the blank font for the visual tests to
 * `src/browser/fonts/visual-blank.ttf`. The font file is committed, so run
 * this script only to change the font.
 *
 *   npm run generate-blank-font -w @mvtjs/visual-testing
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildBlankFont } from '../blank-font';
import { PACKAGE_DIR } from '../paths';

const out = join(PACKAGE_DIR, 'src', 'browser', 'fonts', 'visual-blank.ttf');
const font = buildBlankFont({ family: 'Visual Blank' });
writeFileSync(out, font);
console.log(`Wrote ${font.length} bytes to ${out}`);
