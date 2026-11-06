import { describe, expect, it, vi } from 'vitest';
import { createDemoModel } from './demo-model';

const STEP_MS = 16;

describe('createDemoModel', () => {
    it('moves the machine on by the time given', () => {
        const model = createDemoModel({ seed: 1 });
        const update = vi.spyOn(model.machine, 'update');
        model.update(STEP_MS);
        expect(update).toHaveBeenCalledWith(STEP_MS);
    });
});
