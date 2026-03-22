import { describe, it, expect } from 'vitest';
import { createFuelTankModel } from './fuel-tank-model';

describe('FuelTankModel', () => {
    describe('initial state', () => {
        it('starts inactive and dead', () => {
            const f = createFuelTankModel();
            expect(f.isActive).toBe(false);
            expect(f.isAlive).toBe(false);
        });
    });

    describe('activate', () => {
        it('sets position, alive, and active', () => {
            const f = createFuelTankModel();
            f.activate(10, 8);
            expect(f.worldCol).toBe(10);
            expect(f.worldRow).toBe(8);
            expect(f.isAlive).toBe(true);
            expect(f.isActive).toBe(true);
        });
    });

    describe('kill', () => {
        it('clears alive and active', () => {
            const f = createFuelTankModel();
            f.activate(10, 8);
            f.kill();
            expect(f.isAlive).toBe(false);
            expect(f.isActive).toBe(false);
        });
    });

    describe('deactivate', () => {
        it('clears alive and active', () => {
            const f = createFuelTankModel();
            f.activate(10, 8);
            f.deactivate();
            expect(f.isAlive).toBe(false);
            expect(f.isActive).toBe(false);
        });
    });

    describe('update', () => {
        it('does not change position (stationary)', () => {
            const f = createFuelTankModel();
            f.activate(10, 8);
            f.update(1000);
            expect(f.worldCol).toBe(10);
            expect(f.worldRow).toBe(8);
        });
    });
});
