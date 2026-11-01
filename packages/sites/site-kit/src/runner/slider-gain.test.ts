import { describe, expect, it } from 'vitest';
import { toSliderGain } from './slider-gain';

describe('toSliderGain', () => {
    it('plays the sounds as written at the top, and nothing at the bottom', () => {
        expect(toSliderGain(1)).toBe(1);
        expect(toSliderGain(0)).toBe(0);
    });

    it('falls by about 12 dB half way down, and as much again by a quarter', () => {
        const toDb = (gain: number) => 20 * Math.log10(gain);
        expect(toDb(toSliderGain(0.5))).toBeCloseTo(-12, 0);
        expect(toDb(toSliderGain(0.25)) - toDb(toSliderGain(0.5))).toBeCloseTo(-12, 0);
    });

    it('clamps positions outside 0 to 1 to the slider\'s ends', () => {
        expect(toSliderGain(1.5)).toBe(1);
        expect(toSliderGain(-1)).toBe(0);
    });
});
