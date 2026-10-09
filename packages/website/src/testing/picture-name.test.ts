import { describe, expect, it } from 'vitest';
import { toPictureName } from './picture-name';

describe('pictureName', () => {
    it('joins describe blocks and the name with hyphens', () => {
        expect(toPictureName('SpinButtonView > spin')).toBe('SpinButtonView-spin');
        expect(toPictureName('Crumb Chase > GameView > two seconds in')).toBe('Crumb-Chase-GameView-two-seconds-in');
    });

    it('makes any run of other characters one hyphen, and trims them', () => {
        expect(toPictureName('WinBannerView > counting up, 300 ms in')).toBe('WinBannerView-counting-up-300-ms-in');
        expect(toPictureName('(odd) > name!')).toBe('odd-name');
    });

    it('keeps dots, so sizes and versions read as written', () => {
        expect(toPictureName('text > at 13.5 px')).toBe('text-at-13.5-px');
    });
});
