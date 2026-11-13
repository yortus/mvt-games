import { describe, expect, it } from 'vitest';
import { createPressGesturesViewModel } from './press-gestures-view-model';

const HOLD_MS = 500;
const QUIET_MS = 150;
const KEY = 4;
const OTHER_KEY = 7;
const FINGER = 1;
const OTHER_FINGER = 2;

describe('PressGesturesViewModel', () => {
    it('reports a hold after the update step that finishes it, not during it', async () => {
        const { gestures, held } = setUp();
        gestures.press(KEY, FINGER);
        gestures.update(HOLD_MS);
        expect(held).toEqual([]);
        await Promise.resolve();
        expect(held).toEqual([KEY]);
    });

    it('reports a hold once, however long the key stays down, and no tap as it is let go', async () => {
        const { gestures, tapped, held } = setUp();
        gestures.press(KEY, FINGER);
        gestures.update(HOLD_MS);
        gestures.update(HOLD_MS);
        await Promise.resolve();
        gestures.release(KEY, FINGER);
        expect(held).toEqual([KEY]);
        expect(tapped).toEqual([]);
    });

    it('takes a press let go before its hold for a tap, reported as it is let go', () => {
        const { gestures, tapped, held } = setUp();
        gestures.press(KEY, FINGER);
        gestures.update(HOLD_MS - 1);
        gestures.release(KEY, FINGER);
        expect(tapped).toEqual([KEY]);
        expect(held).toEqual([]);
    });

    it('waits to report a hold until a hold can do something, and a press let go first is a tap', async () => {
        const state = { canHold: false };
        const { gestures, tapped, held } = setUp(state);
        gestures.press(KEY, FINGER);
        gestures.update(HOLD_MS);
        await Promise.resolve();
        expect(held).toEqual([]);
        state.canHold = true;
        gestures.update(0);
        await Promise.resolve();
        expect(held).toEqual([KEY]);

        state.canHold = false;
        gestures.release(KEY, FINGER);
        gestures.press(OTHER_KEY, FINGER);
        gestures.update(HOLD_MS);
        gestures.release(OTHER_KEY, FINGER);
        expect(tapped).toEqual([OTHER_KEY]);
    });

    it('takes no presses while the keys are off', async () => {
        const { gestures, tapped, held } = setUp({ isEnabled: false });
        gestures.press(KEY, FINGER);
        gestures.update(HOLD_MS);
        gestures.release(KEY, FINGER);
        await Promise.resolve();
        expect(tapped).toEqual([]);
        expect(held).toEqual([]);
    });

    it('drops a press that ends off its key, or elsewhere', async () => {
        const { gestures, tapped, held } = setUp();
        gestures.press(KEY, FINGER);
        gestures.release(OTHER_KEY, FINGER);
        gestures.update(HOLD_MS);
        gestures.press(KEY, FINGER);
        gestures.cancel(FINGER);
        gestures.update(HOLD_MS);
        await Promise.resolve();
        expect(tapped).toEqual([]);
        expect(held).toEqual([]);
    });

    it('ignores a second finger while it follows the first', () => {
        const { gestures, tapped } = setUp();
        gestures.press(KEY, FINGER);
        gestures.press(OTHER_KEY, OTHER_FINGER);
        gestures.release(OTHER_KEY, OTHER_FINGER);
        gestures.cancel(OTHER_FINGER);
        expect(gestures.holdProgressFor(OTHER_KEY)).toBe(0);
        gestures.release(KEY, FINGER);
        expect(tapped).toEqual([KEY]);
    });

    it('fills the progress of the key held only, after a moment, and empties it as the key is let go', () => {
        const { gestures } = setUp();
        gestures.press(KEY, FINGER);
        gestures.update(QUIET_MS);
        expect(gestures.holdProgressFor(KEY)).toBe(0);
        gestures.update((HOLD_MS - QUIET_MS) / 2);
        expect(gestures.holdProgressFor(KEY)).toBeCloseTo(0.5);
        expect(gestures.holdProgressFor(OTHER_KEY)).toBe(0);
        gestures.update(HOLD_MS);
        expect(gestures.holdProgressFor(KEY)).toBe(1);
        gestures.release(KEY, FINGER);
        expect(gestures.holdProgressFor(KEY)).toBe(0);
    });
});

function setUp(state: { canHold?: boolean; isEnabled?: boolean } = {}) {
    const tapped: number[] = [];
    const held: number[] = [];
    const gestures = createPressGesturesViewModel({
        holdMs: HOLD_MS,
        quietMs: QUIET_MS,
        isEnabled: () => state.isEnabled ?? true,
        canHold: () => state.canHold ?? true,
        onTapped: (key: number) => tapped.push(key),
        onHeld: (key: number) => held.push(key),
    });
    return { gestures, tapped, held };
}
