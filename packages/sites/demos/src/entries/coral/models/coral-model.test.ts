import { describe, expect, it } from 'vitest';
import { COLS, ROWS } from '../data';
import { createCoralModel, type CoralModel } from './coral-model';

describe('the coral', () => {
    it('grows out from its seeds', () => {
        const model = createCoralModel();
        const before = totalGrowth(model);
        run(model, 1500);
        expect(totalGrowth(model)).toBeGreaterThan(before);
    });

    it('keeps every amount in bounds', () => {
        const model = createCoralModel();
        run(model, 1500);
        for (let i = 0; i < COLS * ROWS; i++) {
            expect(model.growthAt(i)).toBeGreaterThanOrEqual(0);
            expect(model.growthAt(i)).toBeLessThan(1);
        }
    });

    it('starts with coral, and moves on to the next pattern when asked, keeping its growth', () => {
        const model = createCoralModel();
        expect(model.pattern).toBe('coral');
        run(model, 500);
        const before = totalGrowth(model);
        model.nextPattern();
        expect(model.pattern).toBe('spots');
        model.update(16);
        expect(totalGrowth(model)).toBeGreaterThan(before * 0.9);
    });

    it('plants a seed where it is asked to, across the wrapping edges', () => {
        const model = createCoralModel();
        model.seedAt(0, 0);
        expect(model.growthAt(0)).toBeGreaterThan(0.2);
        expect(model.growthAt(ROWS * COLS - 1)).toBeGreaterThan(0.2);
    });
});

function run(model: CoralModel, totalMs: number): void {
    for (let ms = 0; ms < totalMs; ms += 16) model.update(16);
}

function totalGrowth(model: CoralModel): number {
    let total = 0;
    for (let i = 0; i < COLS * ROWS; i++) total += model.growthAt(i);
    return total;
}
