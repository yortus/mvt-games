import { describe, it, expect } from 'vitest';
import { createDragViewModel } from './drag-view-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stepMs(vm: { update(deltaMs: number): void }, totalMs: number): void {
    const step = 16;
    let remaining = totalMs;
    while (remaining > 0) {
        const dt = Math.min(step, remaining);
        vm.update(dt);
        remaining -= dt;
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DragViewModel', () => {
    it('starts with no committed swap and no animation indices', () => {
        const vm = createDragViewModel();
        expect(vm.isCommittedSwap).toBe(false);
        expect(vm.candidateIdx).toBe(-1);
        expect(vm.returningIdx).toBe(-1);
    });

    it('commitSwap sets isCommittedSwap and captures positions', () => {
        const vm = createDragViewModel();
        vm.commitSwap({ col: 2, row: 1 }, { col: 3, row: 1 });
        expect(vm.isCommittedSwap).toBe(true);
        expect(vm.swapOrigin.col).toBe(2);
        expect(vm.swapOrigin.row).toBe(1);
        expect(vm.swapTarget.col).toBe(3);
        expect(vm.swapTarget.row).toBe(1);
    });

    it('clearCommittedSwap resets swap state and animation indices', () => {
        const vm = createDragViewModel();
        vm.commitSwap({ col: 2, row: 1 }, { col: 3, row: 1 });
        vm.setCandidateIdx(5);
        vm.setReturningIdx(3);
        vm.clearCommittedSwap();
        expect(vm.isCommittedSwap).toBe(false);
        expect(vm.swapOrigin.col).toBe(-1);
        expect(vm.swapTarget.col).toBe(-1);
        expect(vm.candidateIdx).toBe(-1);
        expect(vm.returningIdx).toBe(-1);
    });

    it('setCandidateIdx updates candidateIdx', () => {
        const vm = createDragViewModel();
        vm.setCandidateIdx(5);
        expect(vm.candidateIdx).toBe(5);
    });

    it('slideCandidate sets initial visual position', () => {
        const vm = createDragViewModel();
        vm.slideCandidate(10, 20, 30, 40);
        expect(vm.candidateVisual.x).toBe(10);
        expect(vm.candidateVisual.y).toBe(20);
    });

    it('slideCandidate animates toward target over time', () => {
        const vm = createDragViewModel();
        vm.slideCandidate(0, 0, 100, 100);
        stepMs(vm, 200); // well past 120ms duration
        expect(vm.candidateVisual.x).toBeCloseTo(100, 0);
        expect(vm.candidateVisual.y).toBeCloseTo(100, 0);
    });

    it('slideReturn animates toward target and clears returningIdx', () => {
        const vm = createDragViewModel();
        vm.setReturningIdx(7);
        vm.slideReturn(0, 0, 50, 50);
        stepMs(vm, 300); // well past 150ms duration
        expect(vm.returningVisual.x).toBeCloseTo(50, 0);
        expect(vm.returningVisual.y).toBeCloseTo(50, 0);
        expect(vm.returningIdx).toBe(-1); // cleared by onComplete
    });

    it('update with 0 deltaMs is a no-op', () => {
        const vm = createDragViewModel();
        vm.slideCandidate(10, 10, 50, 50);
        const x = vm.candidateVisual.x;
        vm.update(0);
        expect(vm.candidateVisual.x).toBe(x);
    });
});
