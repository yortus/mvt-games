import { describe, expect, it, vi } from 'vitest';
import { createDemoModel } from './demo-model';

const FLOCK_OPTIONS = {
    arenaWidth: 100,
    arenaHeight: 82,
    boidCount: 3,
    separation: 3,
    alignment: 0.5,
    cohesion: 3,
    wander: 9,
    visionAngle: 4,
    maxSpeed: 20,
    minSpeed: 5,
    perceptionRadius: 16,
};

const STEP_MS = 16;

describe('createDemoModel', () => {
    it('moves the flock on by the time given', () => {
        const model = createDemoModel({ flock: FLOCK_OPTIONS });
        const update = vi.spyOn(model.flock, 'update');
        model.update(STEP_MS);
        expect(update).toHaveBeenCalledWith(STEP_MS);
    });
});
