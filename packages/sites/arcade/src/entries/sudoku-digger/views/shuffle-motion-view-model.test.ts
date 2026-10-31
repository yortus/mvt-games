import { describe, expect, it } from 'vitest';
import type { ShuffleKind } from '../models';
import { createShuffleMotionViewModel } from './shuffle-motion-view-model';
import { CELL_SIZE } from './view-constants';

describe('the shuffle motion view model', () => {
    it('slides two swapped columns from each other\'s places into their own, and leaves the rest', () => {
        const state = { progress: 0 };
        const motion = setUp('columns', 3, 5, state);
        // Cell 3 is in column 3, which came from column 5, two columns to the right
        expect(motion.slideAt(3)).toBeCloseTo(2 * CELL_SIZE);
        expect(motion.slideAt(5)).toBeCloseTo(-2 * CELL_SIZE);
        expect(motion.slideAt(4)).toBe(0);
        state.progress = 1;
        expect(motion.slideAt(3)).toBe(0);
    });

    it('puts one of two crossing columns in front, and the other behind, only as they cross', () => {
        const state = { progress: 0.5 };
        const motion = setUp('columns', 3, 5, state);
        expect(motion.depthAt(3)).toBeCloseTo(1);
        expect(motion.depthAt(5)).toBeCloseTo(-1);
        expect(motion.depthAt(4)).toBe(0);
        state.progress = 1;
        expect(motion.depthAt(3)).toBe(0);
    });

    it('turns the board back from a quarter turn, shrinking it most half way', () => {
        const state = { progress: 0 };
        const motion = setUp('turn', 0, 0, state);
        expect(motion.rotation).toBeCloseTo(-Math.PI / 2);
        expect(motion.scale).toBeCloseTo(1);
        state.progress = 0.5;
        expect(motion.rotation).toBeCloseTo(-Math.PI / 4);
        expect(motion.scale).toBeCloseTo(1 / Math.SQRT2);
        state.progress = 1;
        expect(motion.rotation).toBeCloseTo(0);
    });

    it('pulses only the two digits being swapped', () => {
        const motion = setUp('digits', 2, 7, { progress: 0.5 });
        expect(motion.swapPulseFor(2)).toBeCloseTo(1);
        expect(motion.swapPulseFor(7)).toBeCloseTo(1);
        expect(motion.swapPulseFor(3)).toBe(0);
    });
});

function setUp(kind: ShuffleKind, first: number, second: number, state: { progress: number }) {
    return createShuffleMotionViewModel({ shuffle: { kind, first, second, count: 1 }, progress: () => state.progress });
}
