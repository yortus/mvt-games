import { describe, expect, it } from 'vitest';
import { createKeypadGesturesViewModel } from './keypad-gestures-view-model';
import { KEY_HOLD_MS, KEY_HOLD_QUIET_MS } from './view-constants';

const DIGIT = 4;
const OTHER_DIGIT = 7;

describe('KeypadGesturesViewModel', () => {
    it('reports a hold after the update step that finishes it, not during it', async () => {
        const { gestures, held } = setUp();
        gestures.press(DIGIT);
        gestures.update(KEY_HOLD_MS);
        expect(held).toEqual([]);
        await Promise.resolve();
        expect(held).toEqual([DIGIT]);
    });

    it('reports a hold once, however long the key stays down, and no tap as it is let go', async () => {
        const { gestures, tapped, held } = setUp();
        gestures.press(DIGIT);
        gestures.update(KEY_HOLD_MS);
        gestures.update(KEY_HOLD_MS);
        await Promise.resolve();
        gestures.release(DIGIT);
        expect(held).toEqual([DIGIT]);
        expect(tapped).toEqual([]);
    });

    it('takes a press let go before its hold for a tap', async () => {
        const { gestures, tapped, held } = setUp();
        gestures.press(DIGIT);
        gestures.update(KEY_HOLD_MS - 1);
        gestures.release(DIGIT);
        await Promise.resolve();
        expect(tapped).toEqual([DIGIT]);
        expect(held).toEqual([]);
    });

    it('waits to report a hold until holding can fill a cell, and a press let go first is a tap', async () => {
        const state = { canFill: false };
        const { gestures, tapped, held } = setUp(state);
        gestures.press(DIGIT);
        gestures.update(KEY_HOLD_MS);
        await Promise.resolve();
        expect(held).toEqual([]);
        state.canFill = true;
        gestures.update(0);
        await Promise.resolve();
        expect(held).toEqual([DIGIT]);

        state.canFill = false;
        gestures.release(DIGIT);
        gestures.press(OTHER_DIGIT);
        gestures.update(KEY_HOLD_MS);
        gestures.release(OTHER_DIGIT);
        expect(tapped).toEqual([OTHER_DIGIT]);
    });

    it('takes no presses while the keys are off', async () => {
        const { gestures, tapped, held } = setUp({ isEnabled: false });
        gestures.press(DIGIT);
        gestures.update(KEY_HOLD_MS);
        gestures.release(DIGIT);
        await Promise.resolve();
        expect(tapped).toEqual([]);
        expect(held).toEqual([]);
    });

    it('drops a press that ends off its key', async () => {
        const { gestures, tapped, held } = setUp();
        gestures.press(DIGIT);
        gestures.release(OTHER_DIGIT);
        gestures.update(KEY_HOLD_MS);
        await Promise.resolve();
        expect(tapped).toEqual([]);
        expect(held).toEqual([]);
    });

    it('fills the ring of the key held only, after a moment, and empties it as the key is let go', () => {
        const { gestures } = setUp();
        gestures.press(DIGIT);
        gestures.update(KEY_HOLD_QUIET_MS);
        expect(gestures.holdProgressFor(DIGIT)).toBe(0);
        gestures.update((KEY_HOLD_MS - KEY_HOLD_QUIET_MS) / 2);
        expect(gestures.holdProgressFor(DIGIT)).toBeCloseTo(0.5);
        expect(gestures.holdProgressFor(OTHER_DIGIT)).toBe(0);
        gestures.update(KEY_HOLD_MS);
        expect(gestures.holdProgressFor(DIGIT)).toBe(1);
        gestures.release(DIGIT);
        expect(gestures.holdProgressFor(DIGIT)).toBe(0);
    });
});

function setUp(state: { canFill?: boolean; isEnabled?: boolean } = {}) {
    const tapped: number[] = [];
    const held: number[] = [];
    const gestures = createKeypadGesturesViewModel({
        isEnabled: () => state.isEnabled ?? true,
        canFill: () => state.canFill ?? true,
        onTapped: (digit) => tapped.push(digit),
        onHeld: (digit) => held.push(digit),
    });
    return { gestures, tapped, held };
}
