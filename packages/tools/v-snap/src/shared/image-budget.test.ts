import { describe, expect, it } from 'vitest';
import { fitImage } from './image-budget';

const MAX = 500_000;
const ADVICE = 'Crop the image.';

describe('fitImage', () => {
    it('draws an image within the budget at full size, smooth or not', () => {
        expect(fitImage({ width: 960, height: 520, maxPixels: MAX, canScale: false, advice: ADVICE })).toEqual({ resolution: 1 });
        expect(fitImage({ width: MAX, height: 1, maxPixels: MAX, canScale: true, advice: ADVICE })).toEqual({ resolution: 1 });
    });

    it('halves a smooth image over the budget until it fits', () => {
        expect(fitImage({ width: 1208, height: 608, maxPixels: MAX, canScale: true, advice: ADVICE })).toEqual({ resolution: 0.5 });
        // 1600 by 2180 is 3.5 million pixels. At half resolution it is 872,000,
        // and at a quarter it is 218,000.
        expect(fitImage({ width: 1600, height: 2180, maxPixels: MAX, canScale: true, advice: ADVICE })).toEqual({ resolution: 0.25 });
    });

    it('fails an image over the budget that cannot be scaled, and gives the advice', () => {
        const fit = fitImage({ width: 1600, height: 2180, maxPixels: MAX, canScale: false, advice: ADVICE });
        expect('problem' in fit && fit.problem).toContain('over the budget of 500,000');
        expect('problem' in fit && fit.problem).toContain(ADVICE);
    });
});
