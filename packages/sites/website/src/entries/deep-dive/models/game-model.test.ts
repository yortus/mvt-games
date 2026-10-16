import { describe, expect, it } from 'vitest';
import { SUB_X } from '../data';
import { createGameModel, type GameModel } from './game-model';

describe('the deep dive game', () => {
    it('waits at the mouth of the cave until rise is first pressed', () => {
        const model = createGameModel();
        stepUntil(model, () => false, 1000);
        expect(model.phase).toBe('ready');
        expect(model.distance).toBe(0);

        model.risePressed = true;
        model.update(16);
        expect(model.phase).toBe('cruising');
        expect(model.ySpeed).toBeLessThan(0);
    });

    it('sinks when rise is let go, and crashes into the floor', () => {
        const model = createGameModel();
        model.risePressed = true;
        model.update(16);
        model.risePressed = false;
        stepUntil(model, () => model.phase === 'crashed', 10_000);
        expect(model.y).toBeGreaterThan(model.floorAt(model.distance + SUB_X) - 1);
        expect(model.best).toBe(model.distance);
    });

    it('starts again after a crash, keeping the best run', () => {
        const model = createGameModel();
        model.risePressed = true;
        stepUntil(model, () => model.phase === 'crashed', 10_000);
        const best = model.best;
        model.risePressed = false;
        model.restartPressed = true;
        model.update(16);
        expect(model.phase).toBe('ready');
        expect(model.distance).toBe(0);
        expect(model.best).toBe(best);
    });

    it('narrows the further in it goes', () => {
        const model = createGameModel();
        const gapAt = (x: number) => model.floorAt(x) - model.ceilingAt(x);
        expect(gapAt(1000)).toBeLessThan(gapAt(0));
        expect(gapAt(1000)).toBeGreaterThan(0);
    });
});

/** Advances the model a frame at a time until `isDone`, or for `maxMs` of game time. */
function stepUntil(model: GameModel, isDone: () => boolean, maxMs: number): void {
    for (let ms = 0; ms < maxMs && !isDone(); ms += 16) model.update(16);
}
