import { describe, expect, it } from 'vitest';
import { describeGlassWindowChecks } from './glass-window-checks.test-support';
import { LEVEL_SETTINGS } from './levels';
import { createGlassWindow } from './glass-window';

// Two days' windows at every level and in every frame.
// glass-window.slow.test.ts checks twelve.
describeGlassWindowChecks({ days: 2 });

describe('createGlassWindow', () => {
    it('makes the same puzzle from the same seed', () => {
        const settings = LEVEL_SETTINGS.medium;
        const a = createGlassWindow({ seed: 1234, settings, frame: 'rose' });
        const b = createGlassWindow({ seed: 1234, settings, frame: 'rose' });
        expect(b.description).toBe(a.description);
        expect([...b.jumble]).toEqual([...a.jumble]);
    });

    it('makes another puzzle from another seed', () => {
        const settings = LEVEL_SETTINGS.medium;
        expect(createGlassWindow({ seed: 1, settings, frame: 'rose' }).description).not.toBe(createGlassWindow({ seed: 2, settings, frame: 'rose' }).description);
    });
});
