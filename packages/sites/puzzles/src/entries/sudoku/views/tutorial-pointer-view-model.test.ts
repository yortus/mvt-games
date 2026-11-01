import { describe, expect, it } from 'vitest';
import type { TutorialDemoKind } from '../models';
import { findCellMiddleX, findCellMiddleY, findKeyMiddleX, KEY_MIDDLE_Y } from './puzzle-layout';
import { createTutorialPointerViewModel } from './tutorial-pointer-view-model';

// The shows come in for 600 ms, then a tap touches down for 150 ms and lifts for 300

describe('the tutorial pointer view model', () => {
    it('comes in to the cell to select, unseen at first, and taps it, with a ripple', () => {
        const { show, run } = setUp('select', [40], []);
        expect(show.alpha).toBe(0);
        run(600);
        expect(show.x).toBeCloseTo(findCellMiddleX(40));
        expect(show.y).toBeCloseTo(findCellMiddleY(40));
        expect(show.alpha).toBeCloseTo(1);
        run(75);
        expect(show.isDown).toBe(true);
        expect(show.rippleProgress).toBeGreaterThan(0);
        expect(show.rippleProgress).toBeLessThan(1);
        expect([show.touchX, show.touchY]).toEqual([findCellMiddleX(40), findCellMiddleY(40)]);
    });

    it('drags from the first cell to link to the last, trailing from the first', () => {
        const { show, run } = setUp('link', [9, 11], []);
        // Come in, press for 300 ms, then half way through an 800 ms drag
        run(600 + 300 + 400);
        expect(show.isDown).toBe(true);
        expect(show.x).toBeGreaterThan(findCellMiddleX(9));
        expect(show.x).toBeLessThan(findCellMiddleX(11));
        expect(show.touchX).toBeCloseTo(findCellMiddleX(9));
    });

    it('fills a cell by tapping it, then going to its digit\'s key', () => {
        const { show, run } = setUp('fill', [40], [7]);
        // Come in, tap, then all of the 760 ms move to the key
        run(600 + 450 + 760);
        expect(show.x).toBeCloseTo(findKeyMiddleX(7));
        expect(show.y).toBeCloseTo(KEY_MIDDLE_Y);
    });

    it('starts its show over once it ends, and as the demo changes', () => {
        const state = { shown: 1, demo: 'select' as TutorialDemoKind };
        const { show, run } = setUp('select', [40], [], state);
        run(600);
        expect(show.alpha).toBeCloseTo(1);
        state.shown = 2;
        run(16);
        expect(show.alpha).toBeLessThan(0.1);
        // The whole show lasts 3,050 ms, after which the arrow comes in again
        run(3050);
        run(600);
        expect(show.alpha).toBeCloseTo(1);
    });

    it('shows nothing when there is no demo', () => {
        const { show, run } = setUp('none', [], []);
        run(1000);
        expect(show.alpha).toBe(0);
        expect(show.rippleProgress).toBe(1);
    });
});

function setUp(
    demo: TutorialDemoKind,
    cells: readonly number[],
    digits: readonly number[],
    state = { shown: 1, demo },
) {
    const show = createTutorialPointerViewModel({
        demo: () => state.demo,
        demoCells: () => cells,
        demoDigits: () => digits,
        demosShown: () => state.shown,
    });
    /** Runs the show on by `ms`, in frames of at most 16 ms. */
    const run = (ms: number): void => {
        for (let left = ms; left > 0; left -= 16) show.update(Math.min(16, left));
    };
    return { show, run };
}
