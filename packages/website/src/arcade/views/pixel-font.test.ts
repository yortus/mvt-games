import { describe, expect, it } from 'vitest';
import { CATALOGUE } from '../../entries';
import { PIXEL_FONT, PIXEL_HEIGHT, pixelTextWidth } from './pixel-font';

describe('the pixel font', () => {
    it('draws every character in rows of one width, the full height, in cells filled or empty', () => {
        for (const [char, rows] of Object.entries(PIXEL_FONT)) {
            expect(rows.length, char).toBe(PIXEL_HEIGHT);
            for (const row of rows) {
                expect(row.length, char).toBe(rows[0].length);
                expect(row, char).toMatch(/^[#.]+$/);
            }
        }
    });

    it('has every character of every entry\'s name', () => {
        for (const entry of CATALOGUE) {
            for (const char of entry.name.toUpperCase().replaceAll(' ', '')) expect(PIXEL_FONT[char], `${entry.id}: ${char}`).toBeDefined();
        }
    });

    it('has every character of the arcade\'s name', () => {
        for (const char of 'MVT ARCADE'.replaceAll(' ', '')) expect(PIXEL_FONT[char], char).toBeDefined();
    });

    it('measures text set bold: each character a cell wider, a cell between them, and its spaces', () => {
        const a = PIXEL_FONT.A[0].length + 1;
        expect(pixelTextWidth('A')).toBe(a);
        expect(pixelTextWidth('AA')).toBe(2 * a + 1);
        expect(pixelTextWidth('A A')).toBe(2 * a + 1 + 3);
    });
});
