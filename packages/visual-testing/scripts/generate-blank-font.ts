/**
 * Writes the blank font for the visual tests to
 * `src/browser/fonts/visual-blank.ttf`. The font file is committed, so run
 * this script only to change the font.
 *
 *   npm run generate-blank-font -w @mvtjs/visual-testing
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildBlankFont } from '../src/node';

const out = resolve(import.meta.dirname, '..', 'src', 'browser', 'fonts', 'visual-blank.ttf');
const font = buildBlankFont({ family: 'Visual Blank' });
writeFileSync(out, font);
console.log(`Wrote ${font.length} bytes to ${out}`);
