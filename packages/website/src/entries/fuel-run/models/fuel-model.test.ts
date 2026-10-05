import { describe, it, expect } from 'vitest';
import { createFuelModel } from './fuel-model';

function makeFuel(fuelDepletionRate = 0.03) {
    return createFuelModel({ fuelDepletionRate });
}

describe('FuelModel', () => {
    describe('initial state', () => {
        it('starts with full fuel', () => {
            const f = makeFuel();
            expect(f.fuel).toBe(1.0);
            expect(f.isFuelEmpty).toBe(false);
        });
    });

    describe('fuel depletion', () => {
        it('depletes over time', () => {
            const f = makeFuel(1.0); // 1.0 per second for fast test
            f.update(500); // 0.5 second
            expect(f.fuel).toBeCloseTo(0.5, 1);
        });

        it('sets fuelEmpty when fuel reaches zero', () => {
            const f = makeFuel(10); // very fast depletion
            f.update(1000);
            expect(f.fuel).toBe(0);
            expect(f.isFuelEmpty).toBe(true);
        });

        it('does not deplete further once empty', () => {
            const f = makeFuel(10);
            f.update(1000);
            expect(f.isFuelEmpty).toBe(true);
            f.update(1000);
            expect(f.fuel).toBe(0);
        });
    });

    describe('addFuel', () => {
        it('increases fuel capped at 1.0', () => {
            const f = makeFuel(1.0);
            f.update(500); // fuel ~0.5
            f.addFuel(0.25);
            expect(f.fuel).toBeCloseTo(0.75, 1);
        });

        it('caps at 1.0', () => {
            const f = makeFuel();
            f.addFuel(0.5); // already at 1.0
            expect(f.fuel).toBe(1.0);
        });
    });

    describe('reset', () => {
        it('restores fuel to full', () => {
            const f = makeFuel(10);
            f.update(1000); // deplete fuel
            expect(f.isFuelEmpty).toBe(true);
            f.reset();
            expect(f.fuel).toBe(1.0);
            expect(f.isFuelEmpty).toBe(false);
        });
    });
});
