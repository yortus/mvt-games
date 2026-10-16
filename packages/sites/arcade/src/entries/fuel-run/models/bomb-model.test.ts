import { describe, it, expect } from 'vitest';
import { createBombModel } from './bomb-model';

function makeBomb(worldCol = 5, worldRow = 3, vCol = 4, gravity = 20) {
    return createBombModel({ worldCol, worldRow, vCol, gravity });
}

describe('BombModel', () => {
    describe('initial state', () => {
        it('starts at given position', () => {
            const b = makeBomb(5, 3);
            expect(b.worldCol).toBe(5);
            expect(b.worldRow).toBe(3);
        });
    });

    describe('update', () => {
        it('drifts forward and falls under gravity', () => {
            const b = makeBomb(5, 3, 4, 20);
            b.update(1000); // 1 second
            // horizontal: 5 + 4*1 = 9
            expect(b.worldCol).toBeCloseTo(9, 1);
            // vertical: gravity adds vRow += 20*1 = 20, worldRow += 20*1 = 20 + 3 = 23
            expect(b.worldRow).toBeGreaterThan(3);
        });

        it('accelerates downward over time', () => {
            const b = makeBomb(5, 3, 0, 20);
            b.update(100); // 0.1s: vRow = 2, worldRow = 3 + 2*0.1 = 3.2
            const row1 = b.worldRow;
            b.update(100); // 0.1s: vRow = 4, worldRow ~= 3.2 + 4*0.1 = 3.6
            const row2 = b.worldRow;
            const drop1 = row1 - 3;
            const drop2 = row2 - row1;
            expect(drop2).toBeGreaterThan(drop1);
        });
    });
});
