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
    it('starts in real time, with the influences hidden', () => {
        const model = createDemoModel({ flock: FLOCK_OPTIONS });
        expect(model.timeScale).toBe(1);
        expect(model.isShowingInfluences).toBe(false);
    });

    it('moves the flock on by the time given, scaled by the time scale', () => {
        const model = createDemoModel({ flock: FLOCK_OPTIONS });
        const update = vi.spyOn(model.flock, 'update');
        model.timeScale = 2;
        model.update(STEP_MS);
        expect(update).toHaveBeenCalledWith(STEP_MS * model.timeScale);
    });
});
