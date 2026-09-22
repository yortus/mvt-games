import { describe, it, expect } from 'vitest';
import { createBulletModel } from './bullet-model';

describe('BulletModel', () => {
    describe('initial state', () => {
        it('starts at given position', () => {
            const b = createBulletModel({ worldCol: 5, worldRow: 3, speed: 15 });
            expect(b.worldCol).toBe(5);
            expect(b.worldRow).toBe(3);
        });
    });

    describe('update', () => {
        it('moves rightward at given speed', () => {
            const b = createBulletModel({ worldCol: 5, worldRow: 3, speed: 10 });
            b.update(1000);
            expect(b.worldCol).toBeCloseTo(15, 5);
            expect(b.worldRow).toBe(3);
        });
    });
});
