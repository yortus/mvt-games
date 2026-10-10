import { describe, expect, it } from 'vitest';
import { PALETTE_NAMES } from '../data';
import { INTERIOR } from '../models';
import { buildPaletteColors, paintEscapes, PALETTES, RAMP_SIZE } from './palettes';
import { createFixedText, countDigits, formatZoom } from './readouts';

describe('palettes', () => {
    it('lists every palette, with a name and a gradient', () => {
        expect(PALETTES.map((p) => p.name)).toEqual(PALETTE_NAMES);
        for (const palette of PALETTES) {
            expect(palette.label.length).toBeGreaterThan(0);
            expect(palette.swatch).toMatch(/^linear-gradient\(90deg, #[0-9a-f]{6} 0%, .* 100%\)$/);
        }
    });

    it('builds a turn of opaque colours for each, joined end to end', () => {
        for (const name of PALETTE_NAMES) {
            const { ramp, interior } = buildPaletteColors(name);
            expect(ramp.length).toBe(RAMP_SIZE);
            for (let i = 0; i < RAMP_SIZE; i++) expect(ramp[i] >>> 24).toBe(0xff);
            expect(interior >>> 24).toBe(0xff);
            // The last colour leads back into the first
            expect(channelGap(ramp[RAMP_SIZE - 1], ramp[0])).toBeLessThan(8);
        }
    });

    it('paints the set in its own colour, and the rest from the ramp', () => {
        const colors = buildPaletteColors('ember');
        const escapes = new Float32Array([INTERIOR, 0, 4, 100000]);
        const pixels = new Int32Array(4);
        paintEscapes(pixels, escapes, 0, 4, colors);

        expect(pixels[0]).toBe(colors.interior);
        expect(pixels[1]).toBe(colors.ramp[0]);
        expect(colors.ramp).toContain(pixels[2]);
        expect(colors.ramp).toContain(pixels[3]);
    });

    it('paints only the samples asked for', () => {
        const colors = buildPaletteColors('ice');
        const pixels = new Int32Array(4);
        paintEscapes(pixels, new Float32Array(4).fill(INTERIOR), 1, 3, colors);

        expect(Array.from(pixels)).toEqual([0, colors.interior, colors.interior, 0]);
    });
});

describe('readouts', () => {
    it('shows more places as the view narrows, within what a double holds', () => {
        expect(countDigits(3.2)).toBe(5);
        expect(countDigits(1e-6)).toBe(11);
        expect(countDigits(1e-13)).toBe(17);
        expect(countDigits(100)).toBe(4);
    });

    it('formats the zoom plainly, then in powers of ten', () => {
        expect(formatZoom(1)).toBe('1.00x');
        expect(formatZoom(2500)).toBe('2500x');
        expect(formatZoom(3.4e9)).toBe('3.4e9x');
    });

    it('makes a new string only when the number or places change', () => {
        const text = createFixedText();
        const first = text(0.5, 3);

        expect(first).toBe('0.500');
        expect(text(0.5, 3)).toBe(first);
        expect(text(0.5, 4)).toBe('0.5000');
        expect(text(-0.25, 4)).toBe('-0.2500');
    });
});

/** The largest difference between two pixels in any one channel. */
function channelGap(a: number, b: number): number {
    let gap = 0;
    for (let shift = 0; shift < 24; shift += 8) gap = Math.max(gap, Math.abs(((a >>> shift) & 0xff) - ((b >>> shift) & 0xff)));
    return gap;
}
