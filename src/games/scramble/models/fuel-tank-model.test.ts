import { describe, it, expect } from 'vitest';
import { createFuelTankModel } from './fuel-tank-model';

describe('FuelTankModel', () => {
    describe('initial state', () => {
        it('starts inactive and dead', () => {
            const f = createFuelTankModel();
            expect(f.active).toBe(false);
            expect(f.alive).toBe(false);
        });
    });

    describe('activate', () => {
        it('sets position, alive, and active', () => {
            const f = createFuelTankModel();
            f.activate(10, 8);
            expect(f.worldCol).toBe(10);
            expect(f.worldRow).toBe(8);
            expect(f.alive).toBe(true);
            expect(f.active).toBe(true);
        });
    });

    describe('kill', () => {
        it('clears alive and active', () => {
            const f = createFuelTankModel();
            f.activate(10, 8);
            f.kill();
            expect(f.alive).toBe(false);
            expect(f.active).toBe(false);
        });
    });

    describe('deactivate', () => {
        it('clears alive and active', () => {
            const f = createFuelTankModel();
            f.activate(10, 8);
            f.deactivate();
            expect(f.alive).toBe(false);
            expect(f.active).toBe(false);
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
