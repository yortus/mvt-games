import { describe, expect, it } from 'vitest';
import { createScope, registerScopeSource, SCOPE_POINTS, toScopeLength } from './scope';

describe('createScope', () => {
    it('attaches to the source its chip registered, and detaches once as it is destroyed, clearing itself', () => {
        const chip = {};
        const attached: Float32Array[] = [];
        let detached = 0;
        registerScopeSource(chip, {
            voiceCount: 2,
            attach: (data) => attached.push(data),
            detach: () => detached++,
        });
        const scope = createScope(chip);
        expect(attached).toHaveLength(1);
        expect(attached[0]).toHaveLength(toScopeLength(2));
        attached[0].fill(0.5);
        expect([scope.points.length, scope.pans.length, scope.points[0], scope.pans[1]]).toEqual([2 * SCOPE_POINTS, 2, 0.5, 0.5]);
        scope.destroy();
        scope.destroy();
        expect(detached).toBe(1);
        expect(scope.points[0]).toBe(0);
    });

    it('gives a silent scope with no voices for an object that is not a chip', () => {
        const scope = createScope({});
        expect([scope.voiceCount, scope.points.length, scope.pans.length]).toEqual([0, 0, 0]);
        scope.destroy();
    });
});
