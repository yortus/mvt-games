import { describe, expect, it } from 'vitest';
import { toImageName } from './image-name';

describe('toImageName', () => {
    it('joins describe blocks and the name with hyphens', () => {
        expect(toImageName('SpinButtonView > spin')).toBe('SpinButtonView-spin');
        expect(toImageName('Crumb Chase > GameView > two seconds in')).toBe('Crumb-Chase-GameView-two-seconds-in');
    });

    it('turns each run of other characters into one hyphen, and trims hyphens from the ends', () => {
        expect(toImageName('WinBannerView > counting up, 300 ms in')).toBe('WinBannerView-counting-up-300-ms-in');
        expect(toImageName('(odd) > name!')).toBe('odd-name');
    });

    it('keeps dots, so sizes and versions read as written', () => {
        expect(toImageName('text > at 13.5 px')).toBe('text-at-13.5-px');
    });
});
