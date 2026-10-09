import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as fontkit from 'fontkit';
import { describe, expect, it } from 'vitest';
import { buildBlankFont } from './blank-font';

const bytes = buildBlankFont({ family: 'Visual Blank' });
const font = fontkit.create(Buffer.from(bytes)) as fontkit.Font;

describe('buildBlankFont', () => {
    it('is a TrueType font with the family asked for', () => {
        expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('\0\x01\0\0');
        expect(font.familyName).toBe('Visual Blank');
        expect(font.unitsPerEm).toBe(1024);
        expect(font.numGlyphs).toBe(2);
    });

    it('maps every code point to one empty glyph that is 0.625 em wide', () => {
        for (const text of ['Sphinx', '×←⛶', '漢字', '😀🎰', 'عربى']) {
            const run = font.layout(text);
            for (let i = 0; i < run.glyphs.length; i++) {
                expect(run.glyphs[i].id).toBe(1);
                expect(run.positions[i].xAdvance).toBe(640);
                expect(run.glyphs[i].path.commands).toHaveLength(0);
            }
        }
    });

    it('has fixed vertical metrics', () => {
        expect(font.ascent).toBe(820);
        expect(font.descent).toBe(-204);
        expect(font.lineGap).toBe(0);
    });

    it('is the font committed in src/testing/fonts', () => {
        const committed = readFileSync(resolve(import.meta.dirname, '..', '..', 'src', 'testing', 'fonts', 'visual-blank.ttf'));
        expect(new Uint8Array(committed)).toEqual(bytes);
    });
});
