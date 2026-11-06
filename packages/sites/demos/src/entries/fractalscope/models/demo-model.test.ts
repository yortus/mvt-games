import { describe, expect, it, vi } from 'vitest';
import { createDemoModel } from './demo-model';

const STEP_MS = 16;

describe('createDemoModel', () => {
    it('moves the scope on by the time given', () => {
        const model = createDemoModel();
        const update = vi.spyOn(model.scope, 'update');
        model.update(STEP_MS);
        expect(update).toHaveBeenCalledWith(STEP_MS);
    });
});
