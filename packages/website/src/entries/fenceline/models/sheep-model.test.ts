import { describe, expect, it } from 'vitest';
import { createDustDevilModel, type DevilTarget } from './dust-devil-model';
import { createFieldModel } from './field-model';
import { createRandom } from './random';
import { createSheepModel } from './sheep-model';

const STEP_MS = 1000 / 60;
const NO_TARGET: DevilTarget = { row: 0, col: 0, isExposed: false };

describe('SheepModel', () => {
    it('runs from a dust devil that comes near', () => {
        const field = createFieldModel({ rows: 30, cols: 40, obstacles: [] });
        const random = createRandom({ seed: 2 });
        const devil = createDustDevilModel({ row: 15, col: 16, speed: 0, chase: 0, target: NO_TARGET, random, regionAt: field.regionAt });
        const sheep = createSheepModel({ row: 15.5, col: 19.5, random, regionAt: field.regionAt, devils: () => [devil] });
        sheep.update(STEP_MS);
        expect(sheep.phase).toBe('fleeing');
        for (let elapsed = 0; elapsed < 1000; elapsed += STEP_MS) sheep.update(STEP_MS);
        // It runs until it is clear of the dust devil, at col 22
        expect(sheep.col).toBeGreaterThan(21.5);
        expect(sheep.isFacingLeft).toBe(false);
    });

    it('wanders its own region, never crossing a fence', () => {
        const field = createFieldModel({ rows: 10, cols: 10, obstacles: [] });
        field.addFence([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], 11);
        const sheep = createSheepModel({ row: 5.5, col: 2.5, random: createRandom({ seed: 4 }), regionAt: field.regionAt, devils: () => [] });
        for (let elapsed = 0; elapsed < 60_000; elapsed += STEP_MS) {
            sheep.update(STEP_MS);
            expect(sheep.col).toBeLessThan(5);
        }
    });

    it('stays put once penned, and is never lost', () => {
        const field = createFieldModel({ rows: 10, cols: 10, obstacles: [] });
        const sheep = createSheepModel({ row: 5.5, col: 2.5, random: createRandom({ seed: 4 }), regionAt: field.regionAt, devils: () => [] });
        sheep.pen();
        for (let elapsed = 0; elapsed < 5000; elapsed += STEP_MS) sheep.update(STEP_MS);
        sheep.lose();
        expect(sheep.phase).toBe('penned');
        expect(sheep.row).toBe(5.5);
        expect(sheep.col).toBe(2.5);
    });
});
