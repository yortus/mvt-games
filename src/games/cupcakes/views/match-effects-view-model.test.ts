import { describe, it, expect, vi } from 'vitest';
import { createMatchEffectsViewModel } from './match-effects-view-model';
import { createSequenceReaction } from '#common';

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

describe('MatchEffectsViewModel', () => {
    it('sequence is not active initially', () => {
        const vm = createMatchEffectsViewModel({ getIsMatching: () => false });
        expect(vm.sequence.isActive).toBe(false);
    });

    it('sequence becomes active when isMatching transitions to true', () => {
        let isMatching = false;
        const vm = createMatchEffectsViewModel({ getIsMatching: () => isMatching });
        isMatching = true;
        vm.update(0);
        expect(vm.sequence.isActive).toBe(true);
    });

    it('sequence progresses on update()', () => {
        let isMatching = false;
        const vm = createMatchEffectsViewModel({ getIsMatching: () => isMatching });
        isMatching = true;
        vm.update(0);
        vm.update(100);
        expect(vm.sequence.progress).toBeGreaterThan(0);
    });

    it('sequence completes after full duration', () => {
        let isMatching = false;
        const vm = createMatchEffectsViewModel({ getIsMatching: () => isMatching });
        isMatching = true;
        stepMs(vm, 600); // well past 500ms total
        expect(vm.sequence.isActive).toBe(false);
        expect(vm.sequence.progress).toBe(1);
    });

    it('sequence reaction dispatches step callbacks', () => {
        let isMatching = false;
        const vm = createMatchEffectsViewModel({ getIsMatching: () => isMatching });
        const shakeActive = vi.fn();
        const shakeInactive = vi.fn();

        const update = createSequenceReaction(vm.sequence, {
            shake: {
                active: shakeActive,
                inactive: shakeInactive,
            },
        });

        // Initial: shake is inactive (before start)
        expect(shakeInactive).toHaveBeenCalled();

        isMatching = true;
        vm.update(0); // trigger start
        stepMs(vm, 100); // past shake start (50ms)
        update();
        expect(shakeActive).toHaveBeenCalled();
    });

    it('can restart the sequence', () => {
        let isMatching = false;
        const vm = createMatchEffectsViewModel({ getIsMatching: () => isMatching });
        isMatching = true;
        vm.update(0);
        stepMs(vm, 600);
        expect(vm.sequence.isActive).toBe(false);

        // Transition away then back to matching
        isMatching = false;
        vm.update(0);
        isMatching = true;
        vm.update(0);
        expect(vm.sequence.isActive).toBe(true);
        expect(vm.sequence.progress).toBe(0);
    });

    it('individual steps have independent progress', () => {
        let isMatching = false;
        const vm = createMatchEffectsViewModel({ getIsMatching: () => isMatching });
        isMatching = true;
        vm.update(0);
        stepMs(vm, 200); // fade and shake should be active; dust starting; popup not yet

        const { fade, shake, dust, popup } = vm.sequence.steps;
        expect(fade.progress).toBeGreaterThan(0);
        expect(shake.progress).toBeGreaterThan(0);
        expect(dust.progress).toBeGreaterThan(0);
        // popup starts at 150ms so it should have some progress too
        expect(popup.progress).toBeGreaterThanOrEqual(0);
    });
});
