/**
 * Writes the blank font for the visual tests to
 * `src/testing/fonts/visual-blank.ttf`. The font file is committed, so run
 * this script only to change the font.
 *
 *   npm run generate-blank-font -w @mvtjs/website
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildBlankFont } from './blank-font';

const out = resolve(import.meta.dirname, '..', '..', 'src', 'testing', 'fonts', 'visual-blank.ttf');
const font = buildBlankFont({ family: 'Visual Blank' });
writeFileSync(out, font);
console.log(`Wrote ${font.length} bytes to ${out}`);
