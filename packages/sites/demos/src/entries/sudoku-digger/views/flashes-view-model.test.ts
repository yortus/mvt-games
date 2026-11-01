import { describe, expect, it } from 'vitest';
import { createFlashesViewModel } from './flashes-view-model';

describe('the flashes view model', () => {
    it('shakes the grid at a dead end, and settles it again', () => {
        const { flashes, deadEnds } = setUp();
        deadEnds.count = 1;
        flashes.update(16);
        expect(isShaking(flashes)).toBe(true);
        flashes.update(400);
        expect(isShaking(flashes)).toBe(false);
    });

    it('starts no new shake for dead ends that come close behind the last one', () => {
        const { flashes, deadEnds } = setUp();
        deadEnds.count = 1;
        flashes.update(16);
        flashes.update(250);
        expect(isShaking(flashes)).toBe(false);
        deadEnds.count = 2;
        flashes.update(16);
        expect(isShaking(flashes)).toBe(false);
        // Once the gap has passed, the next dead end shakes it again
        flashes.update(200);
        deadEnds.count = 3;
        flashes.update(16);
        expect(isShaking(flashes)).toBe(true);
    });

    it('flashes a dug cell, with its digit fading, until the flash dies away', () => {
        const { flashes, dug } = setUp();
        Object.assign(dug, { count: 1, cell: 40, digit: 7 });
        flashes.update(16);
        expect(flashes.digFlashAt(40)).toBeGreaterThan(0.9);
        expect(flashes.fadingDigitAt(40)).toBe(7);
        expect(flashes.digFlashAt(41)).toBe(0);
        flashes.update(1000);
        expect(flashes.digFlashAt(40)).toBe(0);
    });
});

function setUp() {
    const deadEnds = { count: 0, cell: 0, digit: 0 };
    const dug = { count: 0, cell: -1, digit: 0 };
    const nothing = { count: 0, cell: -1, digit: 0 };
    const flashes = createFlashesViewModel({ deadEnds, dug, needed: nothing, seeds: nothing, placements: nothing });
    flashes.update(16);
    return { flashes, deadEnds, dug };
}

function isShaking(flashes: { shakeX: number; shakeY: number }): boolean {
    return Math.abs(flashes.shakeX) > 0.01 || Math.abs(flashes.shakeY) > 0.01;
}
