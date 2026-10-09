import { describe, expect, it } from 'vitest';
import { toPictureName } from './picture-name';

describe('toPictureName', () => {
    it('joins describe blocks and the name with hyphens', () => {
        expect(toPictureName('SpinButtonView > spin')).toBe('SpinButtonView-spin');
        expect(toPictureName('Crumb Chase > GameView > two seconds in')).toBe('Crumb-Chase-GameView-two-seconds-in');
    });

    it('turns each run of other characters into one hyphen, and trims hyphens from the ends', () => {
        expect(toPictureName('WinBannerView > counting up, 300 ms in')).toBe('WinBannerView-counting-up-300-ms-in');
        expect(toPictureName('(odd) > name!')).toBe('odd-name');
    });

    it('keeps dots, so sizes and versions read as written', () => {
        expect(toPictureName('text > at 13.5 px')).toBe('text-at-13.5-px');
    });
});
