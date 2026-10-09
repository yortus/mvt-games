import { describe, expect, it } from 'vitest';
import { WAVES } from '../data';
import { createGameModel } from './game-model';

describe('GameModel', () => {
    it('counts the raiders still alive in this wave', () => {
        const model = createGameModel({ waves: WAVES });
        const waveSize = WAVES[0].slots.length;
        expect(model.enemiesLeft).toBe(waveSize);
        model.enemies[0].kill();
        expect(model.enemiesLeft).toBe(waveSize - 1);
        for (const enemy of model.enemies) enemy.kill();
        expect(model.enemiesLeft).toBe(0);
    });
});
