import { describe, expect, it } from 'vitest';
import { createArrayRowViewModel } from './array-row-view-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PITCH = 10;
const FRAME_MS = 16;

/** A row of ids, reordered in place by the tests, and a view model over it. */
function setup(ids: number[]) {
    const vm = createArrayRowViewModel({
        getCount: () => ids.length,
        getId: (index) => ids[index],
        pitchPx: PITCH,
    });
    return { ids, vm };
}

function settle(vm: { update: (deltaMs: number) => void }): void {
    for (let i = 0; i < 200; i++) vm.update(FRAME_MS);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('array row view model', () => {
    it('starts an entering card at its position, transparent, and fades it in', () => {
        const { vm } = setup([0, 1, 2]);

        vm.update(0);
        expect(vm.getX(2)).toBe(2 * PITCH);
        expect(vm.getAlpha(2)).toBe(0);
        expect(vm.getScale(2)).toBeLessThan(1);

        settle(vm);
        expect(vm.getAlpha(2)).toBeCloseTo(1, 3);
        expect(vm.getScale(2)).toBeCloseTo(1, 3);
    });

    it('slides reordered cards: each carries its position to its new index', () => {
        const { ids, vm } = setup([0, 1, 2]);
        settle(vm);

        ids.reverse();
        vm.update(FRAME_MS);

        // Index 2 now holds the card that was at index 0, so it is still near
        // the left and travelling right.
        expect(vm.getX(2)).toBeLessThan(PITCH);
        expect(vm.getX(0)).toBeGreaterThan(PITCH);

        settle(vm);
        expect(vm.getX(0)).toBeCloseTo(0, 3);
        expect(vm.getX(2)).toBeCloseTo(2 * PITCH, 3);
    });

    it('slides the cards after a removed one over its gap', () => {
        const { ids, vm } = setup([0, 1, 2]);
        settle(vm);

        ids.splice(0, 1);
        vm.update(FRAME_MS);

        expect(vm.getX(0)).toBeGreaterThan(PITCH / 2);
        settle(vm);
        expect(vm.getX(0)).toBeCloseTo(0, 3);
    });

    it('treats a card that returns after leaving the row as entering again', () => {
        const { ids, vm } = setup([0, 1, 2]);
        settle(vm);

        ids.length = 0;
        vm.update(FRAME_MS);
        ids.push(2, 1, 0);
        vm.update(0);

        expect(vm.getX(0)).toBe(0);
        expect(vm.getAlpha(0)).toBe(0);
    });
});
