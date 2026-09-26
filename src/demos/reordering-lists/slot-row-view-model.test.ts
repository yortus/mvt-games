import { describe, expect, it } from 'vitest';
import { createOrderedSlotList } from '#common';
import { createSlotRowViewModel } from './slot-row-view-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PITCH = 10;
const FRAME_MS = 16;
const RELEASE_MS = 700;

function setup(labels: string[]) {
    const list = createOrderedSlotList<string>({ releaseDelayMs: RELEASE_MS });
    for (let i = 0; i < labels.length; i++) list.append(labels[i]);
    const vm = createSlotRowViewModel({ slots: list.slots, pitchPx: PITCH });
    return { list, vm };
}

function settle(vm: { update: (deltaMs: number) => void }, frames = 200): void {
    for (let i = 0; i < frames; i++) vm.update(FRAME_MS);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('slot row view model', () => {
    it('starts an entering card at its position, transparent, and fades it in', () => {
        const { vm } = setup(['A', 'B', 'C']);

        vm.update(0);
        expect(vm.getX(2)).toBe(2 * PITCH);
        expect(vm.getAlpha(2)).toBe(0);

        settle(vm);
        expect(vm.getAlpha(2)).toBeCloseTo(1, 3);
        expect(vm.getScale(2)).toBeCloseTo(1, 3);
    });

    it('slides reordered cards: a card keeps its slot, and its ordinal changes', () => {
        const { list, vm } = setup(['A', 'B', 'C']);
        settle(vm);

        list.move(0, 2);
        vm.update(FRAME_MS);

        // Storage slot 0 still holds A, now at ordinal 2, travelling right.
        expect(list.slots.at(0)!.ordinal).toBe(2);
        expect(vm.getX(0)).toBeLessThan(PITCH);

        settle(vm);
        expect(vm.getX(0)).toBeCloseTo(2 * PITCH, 3);
        expect(vm.getX(1)).toBeCloseTo(0, 3);
    });

    it('fades and raises a removed card where it stands while the rest close the gap', () => {
        const { list, vm } = setup(['A', 'B', 'C']);
        settle(vm);

        list.remove(list.slots.at(0)!);
        settle(vm, 40);

        expect(vm.getX(0)).toBe(0);
        expect(vm.getY(0)).toBeLessThan(0);
        expect(vm.getAlpha(0)).toBeLessThan(0.1);
        expect(vm.getX(1)).toBeCloseTo(0, 1);
    });

    it('treats a new card in a released slot as entering, not as the old card', () => {
        const { list, vm } = setup(['A', 'B', 'C']);
        settle(vm);

        list.remove(list.slots.at(0)!);
        list.update(RELEASE_MS);
        const slot = list.append('D');
        vm.update(0);

        expect(slot.index).toBe(0);
        expect(vm.getX(0)).toBe(2 * PITCH);
        expect(vm.getAlpha(0)).toBe(0);
    });
});
