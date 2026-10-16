import { describe, expect, it } from 'vitest';
import { createEnemyModel } from './enemy-model';

const FIELD = 12;
const SPEED = 4;
const TICK_MS = 1000 / 60;

describe('EnemyModel: popped or gone', () => {
    it('pops when pumped to the last stage, and has not escaped', () => {
        const enemy = createEnemy({ row: 5, col: 5 });
        let popped = false;
        while (!popped) popped = enemy.inflate();
        expect(enemy.phase).toBe('popped');
        expect(enemy.isAlive).toBe(false);
        expect(enemy.hasEscaped).toBe(false);
    });

    it('has escaped once it flees off the field, though its phase is popped', () => {
        const enemy = createEnemy({ row: 0, col: 3 });
        enemy.startFleeing();
        // Long enough to cross the field
        const ticks = Math.ceil(2 * FIELD * 1000 / SPEED / TICK_MS);
        for (let i = 0; i < ticks && enemy.isAlive; i++) enemy.update(TICK_MS);
        expect(enemy.isAlive).toBe(false);
        expect(enemy.phase).toBe('popped');
        expect(enemy.hasEscaped).toBe(true);
    });
});

function createEnemy(start: { row: number; col: number }) {
    return createEnemyModel({
        startRow: start.row,
        startCol: start.col,
        kind: 'mole',
        speed: SPEED,
        // Never ghosts in these tests
        ghostInterval: 1000,
        fieldRows: FIELD,
        fieldCols: FIELD,
        isWalkable: (row, col) => row >= 0 && row < FIELD && col >= 0 && col < FIELD,
        chaseTarget: { row: FIELD - 1, col: FIELD - 1 },
    });
}
