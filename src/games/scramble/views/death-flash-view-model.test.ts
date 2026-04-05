import { describe, it, expect } from 'vitest';
import { createDeathFlashViewModel } from './death-flash-view-model';

describe('DeathFlashViewModel', () => {
    it('starts invisible', () => {
        const vm = createDeathFlashViewModel({ getIsDying: () => false });
        expect(vm.isVisible).toBe(false);
        expect(vm.alpha).toBe(0);
    });

    it('becomes visible when isDying transitions to true', () => {
        let isDying = false;
        const vm = createDeathFlashViewModel({ getIsDying: () => isDying });
        isDying = true;
        vm.update(0);
        expect(vm.isVisible).toBe(true);
        expect(vm.alpha).toBe(1);
    });

    it('alpha decreases over time', () => {
        let isDying = false;
        const vm = createDeathFlashViewModel({ getIsDying: () => isDying });
        isDying = true;
        vm.update(0);
        vm.update(100);
        expect(vm.alpha).toBeGreaterThan(0);
        expect(vm.alpha).toBeLessThan(1);
    });

    it('becomes invisible after full duration', () => {
        let isDying = false;
        const vm = createDeathFlashViewModel({ getIsDying: () => isDying });
        isDying = true;
        vm.update(0);
        vm.update(250); // past 200ms duration
        expect(vm.isVisible).toBe(false);
        expect(vm.alpha).toBe(0);
    });

    it('can be re-triggered', () => {
        let isDying = false;
        const vm = createDeathFlashViewModel({ getIsDying: () => isDying });
        isDying = true;
        vm.update(0);
        vm.update(250);
        expect(vm.isVisible).toBe(false);

        // Transition away then back to dying
        isDying = false;
        vm.update(0);
        isDying = true;
        vm.update(0);
        expect(vm.isVisible).toBe(true);
        expect(vm.alpha).toBe(1);
    });
});
