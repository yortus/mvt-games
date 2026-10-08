/**
 * Writes the visual tests' blank font, `src/testing/fonts/visual-blank.ttf`.
 * Its output is committed; run it only to change the font.
 *
 *   npm run generate-blank-font -w @mvtjs/website
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildBlankFont } from './blank-font';

const out = resolve(import.meta.dirname, '..', '..', 'src', 'testing', 'fonts', 'visual-blank.ttf');
const font = buildBlankFont({ family: 'Visual Blank' });
writeFileSync(out, font);
console.log(`${out}: ${font.length} bytes`);
