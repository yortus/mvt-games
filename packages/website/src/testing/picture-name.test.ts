import { describe, expect, it } from 'vitest';
import { pictureName } from './picture-name';

describe('pictureName', () => {
    it('joins describe blocks and the name with hyphens', () => {
        expect(pictureName('SpinButtonView > spin')).toBe('SpinButtonView-spin');
        expect(pictureName('Crumb Chase > GameView > two seconds in')).toBe('Crumb-Chase-GameView-two-seconds-in');
    });

    it('makes any run of other characters one hyphen, and trims them', () => {
        expect(pictureName('WinBannerView > counting up, 300 ms in')).toBe('WinBannerView-counting-up-300-ms-in');
        expect(pictureName('(odd) > name!')).toBe('odd-name');
    });

    it('keeps dots, so sizes and versions read as written', () => {
        expect(pictureName('text > at 13.5 px')).toBe('text-at-13.5-px');
    });
});
