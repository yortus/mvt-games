import { describe, expect, it, vi } from 'vitest';
import { createDemoModel } from './demo-model';

const STEP_MS = 16;

describe('createDemoModel', () => {
    it('moves the tracker on by the time given', () => {
        const model = createDemoModel({ tuneCount: 1 });
        const update = vi.spyOn(model.tracker, 'update');
        model.update(STEP_MS);
        expect(update).toHaveBeenCalledWith(STEP_MS);
    });
});
