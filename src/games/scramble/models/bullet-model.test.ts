import { describe, it, expect } from 'vitest';
import { createBulletModel } from './bullet-model';

describe('BulletModel', () => {
    describe('initial state', () => {
        it('starts inactive at origin', () => {
            const b = createBulletModel();
            expect(b.active).toBe(false);
            expect(b.worldCol).toBe(0);
            expect(b.worldRow).toBe(0);
        });
    });

    describe('fire', () => {
        it('activates at given position with speed', () => {
            const b = createBulletModel();
            b.fire(5, 3, 15);
            expect(b.active).toBe(true);
            expect(b.worldCol).toBe(5);
            expect(b.worldRow).toBe(3);
        });
    });

    describe('update', () => {
        it('moves rightward at given speed', () => {
            const b = createBulletModel();
            b.fire(5, 3, 10);
            b.update(1000);
            expect(b.worldCol).toBeCloseTo(15, 5);
            expect(b.worldRow).toBe(3);
        });

        it('does not move when inactive', () => {
            const b = createBulletModel();
            b.update(1000);
            expect(b.worldCol).toBe(0);
        });
    });

    describe('deactivate', () => {
        it('sets inactive', () => {
            const b = createBulletModel();
            b.fire(5, 3, 10);
            expect(b.active).toBe(true);
            b.deactivate();
            expect(b.active).toBe(false);
        });
    });
});
