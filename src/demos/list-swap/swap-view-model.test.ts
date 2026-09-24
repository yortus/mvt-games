import { describe, expect, it } from 'vitest';
import { createSwapModel } from './swap-model';
import { createSwapViewModel, type CosmeticKeyKind } from './swap-view-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PITCH = 10;
const FRAME_MS = 16;

function setup(keyBy: CosmeticKeyKind) {
    // autoSwapMs is effectively disabled so the tests drive swaps themselves.
    const model = createSwapModel({ labels: ['A', 'B', 'C'], autoSwapMs: 1e9 });
    const vm = createSwapViewModel({
        getTileCount: () => model.tiles.length,
        getTileId: (index) => model.tiles[index].id,
        keyBy,
        pitchPx: PITCH,
    });

    // Settle: every tile starts seeded at its slot target.
    vm.update(FRAME_MS);

    return { model, vm };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('swap view model', () => {
    it('seeds every tile at its slot target', () => {
        const { vm } = setup('item');

        expect(vm.getX(0)).toBe(0);
        expect(vm.getX(1)).toBe(PITCH);
        expect(vm.getX(2)).toBe(2 * PITCH);
    });

    it('item-keyed state slides: the tile carries its position to the new slot', () => {
        const { model, vm } = setup('item');

        model.swap(0, 2);
        vm.update(FRAME_MS);

        // Slot 2 now holds the tile that was at slot 0, so its eased position
        // is still near the left and travelling right.
        expect(vm.getX(2)).toBeGreaterThan(0);
        expect(vm.getX(2)).toBeLessThan(2 * PITCH * 0.5);
        expect(vm.getX(0)).toBeGreaterThan(2 * PITCH * 0.5);

        // And it gets there.
        for (let i = 0; i < 200; i++) vm.update(FRAME_MS);
        expect(vm.getX(0)).toBeCloseTo(0, 3);
        expect(vm.getX(2)).toBeCloseTo(2 * PITCH, 3);
    });

    it('item-keyed state pulses the tiles that changed slot', () => {
        const { model, vm } = setup('item');

        model.swap(0, 2);
        vm.update(FRAME_MS);

        expect(vm.getScale(0)).toBeGreaterThan(1);
        expect(vm.getScale(2)).toBeGreaterThan(1);
        // The untouched middle tile does not pulse.
        expect(vm.getScale(1)).toBe(1);
    });

    it('slot-keyed state cannot see the reorder: labels jump, nothing moves', () => {
        const { model, vm } = setup('slot');

        model.swap(0, 2);
        vm.update(FRAME_MS);

        expect(vm.getX(0)).toBe(0);
        expect(vm.getX(2)).toBe(2 * PITCH);
        expect(vm.getScale(0)).toBe(1);
        expect(vm.getScale(2)).toBe(1);
    });
});
