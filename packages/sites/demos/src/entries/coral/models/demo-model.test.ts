import { describe, expect, it } from 'vitest';
import { COLS, ROWS } from '../data';
import { createDemoModel, type DemoModel } from './demo-model';

describe('the coral', () => {
    it('grows out from its seeds, keeping every amount in bounds', () => {
        const model = createDemoModel();
        const before = totalGrowth(model);
        run(model, 500);
        expect(totalGrowth(model)).toBeGreaterThan(before);
        let lowest = Infinity;
        let highest = -Infinity;
        for (let i = 0; i < COLS * ROWS; i++) {
            lowest = Math.min(lowest, model.growthAt(i));
            highest = Math.max(highest, model.growthAt(i));
        }
        expect(lowest).toBeGreaterThanOrEqual(0);
        expect(highest).toBeLessThan(1);
    });

    it('starts with coral, and moves on to the next pattern when asked, keeping its growth', () => {
        const model = createDemoModel();
        expect(model.pattern).toBe('coral');
        run(model, 160);
        const before = totalGrowth(model);
        model.nextPattern();
        expect(model.pattern).toBe('spots');
        model.update(16);
        expect(totalGrowth(model)).toBeGreaterThan(before * 0.9);
    });

    it('plants a seed where it is asked to, across the wrapping edges', () => {
        const model = createDemoModel();
        model.seedAt(0, 0);
        expect(model.growthAt(0)).toBeGreaterThan(0.2);
        expect(model.growthAt(ROWS * COLS - 1)).toBeGreaterThan(0.2);
    });
});

function run(model: DemoModel, totalMs: number): void {
    for (let ms = 0; ms < totalMs; ms += 16) model.update(16);
}

function totalGrowth(model: DemoModel): number {
    let total = 0;
    for (let i = 0; i < COLS * ROWS; i++) total += model.growthAt(i);
    return total;
}
