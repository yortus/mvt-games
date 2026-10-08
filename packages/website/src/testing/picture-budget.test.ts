import { describe, expect, it } from 'vitest';
import { fitPicture } from './picture-budget';

const MAX = 500_000;

describe('fitPicture', () => {
    it('draws a picture within the budget at full size, smooth or not', () => {
        expect(fitPicture({ width: 960, height: 520, maxPixels: MAX, canScale: false })).toEqual({ resolution: 1 });
        expect(fitPicture({ width: MAX, height: 1, maxPixels: MAX, canScale: true })).toEqual({ resolution: 1 });
    });

    it('halves a smooth picture over the budget until it fits', () => {
        expect(fitPicture({ width: 1208, height: 608, maxPixels: MAX, canScale: true })).toEqual({ resolution: 0.5 });
        // 1600 by 2180 is 3.5 million: a half is 872,000, a quarter 218,000
        expect(fitPicture({ width: 1600, height: 2180, maxPixels: MAX, canScale: true })).toEqual({ resolution: 0.25 });
    });

    it('fails a picture over the budget that cannot be scaled, saying what to do', () => {
        const fit = fitPicture({ width: 1600, height: 2180, maxPixels: MAX, canScale: false });
        expect('problem' in fit && fit.problem).toContain('over the budget of 500,000');
        expect('problem' in fit && fit.problem).toContain("artStyle: 'smooth'");
    });
});
