import { describe, expect, it } from 'vitest';
import { WRECKAGE_MS } from '../data';
import { createBattleModel } from './battle-model';
import { createGameModel } from './game-model';

describe('BattleModel', () => {
    it('lets a wreck burn out once its time is up, and not before', () => {
        const battle = createBattleModel({ track: createGameModel().track });
        battle.leaveWreckage(0, 0, 0, 0);
        battle.step(WRECKAGE_MS - 1);
        expect(battle.wreckage.some((w) => w.isActive)).toBe(true);
        battle.step(1);
        expect(battle.wreckage.some((w) => w.isActive)).toBe(false);
    });
});
