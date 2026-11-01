import { describe, expect, it } from 'vitest';
import { createDoubleTapTracker } from './double-tap-tracker';

describe('the double tap tracker', () => {
    it('takes a second tap on the same thing, soon after the first, as a double tap', () => {
        const taps = createDoubleTapTracker();
        taps.noteTap(4);
        taps.update(100);
        expect(taps.isSecondTap(4)).toBe(true);
        expect(taps.isSecondTap(5)).toBe(false);
    });

    it('takes a second tap too long after the first as a tap of its own', () => {
        const taps = createDoubleTapTracker();
        taps.noteTap(4);
        taps.update(500);
        expect(taps.isSecondTap(4)).toBe(false);
    });

    it('starts no double tap from a tap it has forgotten, as once a double tap is done', () => {
        const taps = createDoubleTapTracker();
        taps.noteTap(4);
        taps.forget();
        expect(taps.isSecondTap(4)).toBe(false);
    });
});
