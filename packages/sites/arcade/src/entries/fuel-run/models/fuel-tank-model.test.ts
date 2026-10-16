import { describe, it, expect } from 'vitest';
import { createFuelTankModel } from './fuel-tank-model';

describe('FuelTankModel', () => {
    describe('initial state', () => {
        it('starts at given position', () => {
            const f = createFuelTankModel({ worldCol: 10, worldRow: 8 });
            expect(f.worldCol).toBe(10);
            expect(f.worldRow).toBe(8);
        });
    });
});
