import { describe, expect, it } from 'vitest';
import { parsePixelArt } from './pixel-art';

describe('parsePixelArt', () => {
    it('splits a picture into its rows, trimming the indentation and skipping blank lines', () => {
        const rows = parsePixelArt(`
            .W.

            WWW
            .W.
        `);
        expect(rows).toEqual(['.W.', 'WWW', '.W.']);
    });

    it('keeps a row that starts with #, which is a pixel, not a comment', () => {
        expect(parsePixelArt('###.\n#..#')).toEqual(['###.', '#..#']);
    });
});
