import { describe, expect, it } from 'vitest';
import {
    FIRST_GLYPH_CODE, findGlyph, GLYPH_BASELINE_ROWS, GLYPH_COLUMNS, GLYPH_ROWS, LAST_GLYPH_CODE, listGlyphRuns, PIXEL_GLYPHS,
} from './pixel-glyphs';

describe('pixel glyphs', () => {
    it('have one glyph for every printable ASCII character, from the space to ~', () => {
        expect(PIXEL_GLYPHS).toHaveLength(LAST_GLYPH_CODE - FIRST_GLYPH_CODE + 1);
        expect(findGlyph(' '.charCodeAt(0))).toEqual([]);
        expect(findGlyph('~'.charCodeAt(0))).toBe(PIXEL_GLYPHS[PIXEL_GLYPHS.length - 1]);
        expect(findGlyph(FIRST_GLYPH_CODE - 1)).toBeUndefined();
        expect(findGlyph(LAST_GLYPH_CODE + 1)).toBeUndefined();
    });

    it('draw every glyph in rows of cells as wide as the font, no taller than its rows', () => {
        for (let code = FIRST_GLYPH_CODE; code <= LAST_GLYPH_CODE; code++) {
            const glyph = findGlyph(code) ?? [];
            const name = String.fromCharCode(code);
            expect(glyph.length, name).toBeLessThanOrEqual(GLYPH_ROWS);
            for (const row of glyph) expect(row, name).toMatch(new RegExp(`^[#.]{${GLYPH_COLUMNS}}$`));
        }
    });

    it('reach below the baseline only for descenders, a comma\'s tail and the underscore', () => {
        const below: string[] = [];
        for (let code = FIRST_GLYPH_CODE; code <= LAST_GLYPH_CODE; code++) {
            const glyph = findGlyph(code) ?? [];
            if (glyph.slice(GLYPH_BASELINE_ROWS).some((row) => row.includes('#'))) below.push(String.fromCharCode(code));
        }
        expect(below.sort()).toEqual([',', '_', 'g', 'j', 'p', 'q', 'y'].sort());
    });

    it('list a glyph\'s filled cells as runs along its rows', () => {
        expect(listGlyphRuns(['#.##.', '.....', '#####'])).toEqual([[0, 0, 1], [2, 0, 2], [0, 2, 5]]);
        expect(listGlyphRuns([])).toEqual([]);
    });
});
