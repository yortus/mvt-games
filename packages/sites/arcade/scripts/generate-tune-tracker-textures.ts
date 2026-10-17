/**
 * Generate the Tune Tracker's pixel font, as one PNG of white glyphs that
 * the views tint.
 *
 * Run:  npx tsx scripts/generate-tune-tracker-textures.ts
 *
 * The glyphs are the site's pixel glyphs (`#pixel-glyphs`), five cells
 * wide, for every printable ASCII character, and the tracker's own symbols,
 * drawn here, after `~`. The sheet holds them in cells of `CELL_WIDTH` by
 * `CELL_HEIGHT`, sixteen to a row, in character code order from the space.
 * `pixel-font.ts`, in the entry's views, cuts the sheet up the same way.
 */

import { PNG } from 'pngjs';
import { FIRST_GLYPH_CODE, GLYPH_COLUMNS, GLYPH_ROWS, PIXEL_GLYPHS } from '#pixel-glyphs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Output directory
// ---------------------------------------------------------------------------

const OUT_DIR = join(import.meta.dirname, '..', 'src', 'entries', 'tune-tracker', 'assets');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Each glyph's cell: its columns and a column of space, its rows and a row of space. */
const CELL_WIDTH = GLYPH_COLUMNS + 1;
const CELL_HEIGHT = GLYPH_ROWS + 1;
const COLUMNS = 16;

// ---------------------------------------------------------------------------
// Glyphs
// ---------------------------------------------------------------------------

/**
 * The glyphs, in character code order from the space: the site's pixel
 * glyphs for the printable ASCII characters, then the tracker's own
 * symbols, from code 127.
 */
const GLYPHS: readonly (readonly string[])[] = [
    ...PIXEL_GLYPHS,
    // The tracker's symbols, from code 127: play, stop, a column's rule the
    // cell's full height, a blank's dot, and the loop's arrow
    ['#....', '##...', '###..', '####.', '###..', '##...', '#....'],
    ['.....', '#####', '#####', '#####', '#####', '#####', '.....'],
    ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    ['.....', '.....', '.....', '..#..', '.....', '.....', '.....'],
    ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '..###'],
];

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

const rows = Math.ceil(GLYPHS.length / COLUMNS);
const png = new PNG({ width: COLUMNS * CELL_WIDTH, height: rows * CELL_HEIGHT });
png.data.fill(0);

for (let index = 0; index < GLYPHS.length; index++) {
    const glyph = GLYPHS[index];
    const left = (index % COLUMNS) * CELL_WIDTH;
    const top = Math.floor(index / COLUMNS) * CELL_HEIGHT;
    for (let y = 0; y < glyph.length; y++) {
        if (glyph[y].length !== GLYPH_COLUMNS) {
            throw new Error(`glyph ${String.fromCharCode(FIRST_GLYPH_CODE + index)} (code ${FIRST_GLYPH_CODE + index}), row ${y}: '${glyph[y]}' is not ${GLYPH_COLUMNS} wide`);
        }
        for (let x = 0; x < glyph[y].length; x++) {
            if (glyph[y][x] !== '#') continue;
            const at = ((top + y) * png.width + left + x) * 4;
            png.data[at] = 255;
            png.data[at + 1] = 255;
            png.data[at + 2] = 255;
            png.data[at + 3] = 255;
        }
    }
}

writeFileSync(join(OUT_DIR, 'font.png'), PNG.sync.write(png));
console.log(`  font.png (${GLYPHS.length} glyphs, ${png.width}×${png.height})`);
