import { describe, expect, it } from 'vitest';
import type { Demo } from '../models';
import { createPointerViewModel, type ScreenPoint } from './pointer-view-model';

// The targets here are points on the screen already. The shows come in for 600 ms, then a tap touches down for 150 ms and lifts for 300

const A: ScreenPoint = { x: 100, y: 200 };
const B: ScreenPoint = { x: 220, y: 200 };
const C: ScreenPoint = { x: 220, y: 320 };

describe('PointerViewModel', () => {
    it('comes in to a tap\'s target, unseen at first, and taps it, with a ripple', () => {
        const { show, run } = setUp([{ kind: 'tap', targets: [A] }]);
        expect(show.alpha).toBe(0);
        run(600);
        expect([show.x, show.y]).toEqual([A.x, A.y]);
        expect(show.alpha).toBeCloseTo(1);
        run(75);
        expect(show.isDown).toBe(true);
        expect(show.rippleProgress).toBeGreaterThan(0);
        expect(show.rippleProgress).toBeLessThan(1);
        expect([show.touchX, show.touchY]).toEqual([A.x, A.y]);
    });

    it('drags through its targets in turn, trailing from where it pressed', () => {
        const { show, run } = setUp([{ kind: 'drag', targets: [A, B, C] }]);
        // Come in, press for 300 ms, then the 800 ms drag shares out over its two legs: half way through the first
        run(600 + 300 + 200);
        expect(show.isDown).toBe(true);
        expect(show.x).toBeGreaterThan(A.x);
        expect(show.x).toBeLessThan(B.x);
        expect(show.touchX).toBe(A.x);
        // Then half way through the second, on its way down to C
        run(400);
        expect(show.x).toBeCloseTo(B.x);
        expect(show.y).toBeGreaterThan(B.y);
        expect(show.y).toBeLessThan(C.y);
    });

    it('moves from one touch to the next: a tap, then a double tap', () => {
        const { show, run } = setUp([{ kind: 'tap', targets: [A] }, { kind: 'double-tap', targets: [B] }]);
        // Come in, tap, then all of the 380 ms move, a short one
        run(600 + 450 + 380);
        expect([show.x, show.y]).toEqual([B.x, B.y]);
        // Two quick touches of 110 ms each, with a lift between
        run(55);
        expect(show.isDown).toBe(true);
        run(110);
        expect(show.isDown).toBe(false);
        run(110);
        expect(show.isDown).toBe(true);
    });

    it('holds down on a hold\'s target, with no ripple, while a ring fills under it, then lifts', () => {
        const { show, run } = setUp([{ kind: 'tap', targets: [B] }, { kind: 'hold', targets: [A] }]);
        // Come in and tap B, move to A, touch down for 150 ms, then stay down for 1,100 more while the ring fills
        run(600 + 450 + 380 + 150 + 550);
        expect(show.isDown).toBe(true);
        expect([show.touchX, show.touchY]).toEqual([A.x, A.y]);
        expect(show.rippleProgress).toBe(1);
        expect(show.holdProgress).toBeCloseTo(0.5, 1);
        run(600);
        expect(show.isDown).toBe(false);
        expect(show.holdProgress).toBe(0);
    });

    it('starts its show over once it ends, and as the demo changes', () => {
        const state = { shown: 1 };
        const { show, run } = setUp([{ kind: 'tap', targets: [A] }], state);
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
        const { show, run } = setUp([]);
        run(1000);
        expect(show.alpha).toBe(0);
        expect(show.rippleProgress).toBe(1);
    });
});

function setUp(demo: Demo<ScreenPoint>, state = { shown: 1 }) {
    const show = createPointerViewModel({
        demo: () => demo,
        demosShown: () => state.shown,
        findPoint: (point) => point,
        screenWidth: 540,
        screenHeight: 768,
    });
    /** Runs the show on by `ms`, in frames of at most 16 ms. */
    const run = (ms: number): void => {
        for (let left = ms; left > 0; left -= 16) show.update(Math.min(16, left));
    };
    return { show, run };
}
