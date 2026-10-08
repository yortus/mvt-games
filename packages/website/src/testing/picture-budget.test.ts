import { describe, expect, it } from 'vitest';
import { MAX_PICTURE_PIXELS, overBudget } from './picture-budget';

describe('overBudget', () => {
    it('allows a picture up to the budget', () => {
        expect(overBudget(MAX_PICTURE_PIXELS, 1, undefined)).toBeUndefined();
        expect(overBudget(960, 520, false)).toBeUndefined();
    });

    it('says why a picture over it fails, and what to do', () => {
        const reason = overBudget(MAX_PICTURE_PIXELS + 1, 1, undefined);
        expect(reason).toContain('over the budget');
        expect(reason).toContain('large: true');
    });

    it('allows a large picture asked for', () => {
        expect(overBudget(1600, 2180, true)).toBeUndefined();
    });
});
