import { describe, expect, it } from 'vitest';
import { createRandom } from '@mvtjs/site-kit/random';
import { createDemoModel, type DemoModel } from './demo-model';

describe('the coral', () => {
    it('grows out from its seeds, keeping every amount in bounds', () => {
        const model = createSmallModel();
        const before = totalGrowth(model);
        run(model, 500);
        expect(totalGrowth(model)).toBeGreaterThan(before);
        let lowest = Infinity;
        let highest = -Infinity;
        for (let i = 0; i < CELLS; i++) {
            lowest = Math.min(lowest, model.growthAt(i));
            highest = Math.max(highest, model.growthAt(i));
        }
        expect(lowest).toBeGreaterThanOrEqual(0);
        expect(highest).toBeLessThan(1);
    });

    it('starts with coral, and moves on to the next pattern when asked, keeping its growth', () => {
        const model = createSmallModel();
        expect(model.pattern).toBe('coral');
        run(model, 160);
        const before = totalGrowth(model);
        model.nextPattern();
        expect(model.pattern).toBe('spots');
        model.update(16);
        expect(totalGrowth(model)).toBeGreaterThan(before * 0.9);
    });

    it('plants a seed where it is asked to, across the wrapping edges', () => {
        const model = createSmallModel();
        model.seedAt(0, 0);
        expect(model.growthAt(0)).toBeGreaterThan(0.2);
        expect(model.growthAt(CELLS - 1)).toBeGreaterThan(0.2);
    });
});

/**
 * A grid smaller than the demo's, which keeps the tests quick, since every
 * cell is worked out on every step. The rules are the same at any size. On
 * a much smaller grid, though, the first seeds can crowd each other out, and
 * the growth can die away.
 */
const COLS = 32;
const ROWS = 24;
const CELLS = COLS * ROWS;

function createSmallModel(): DemoModel {
    // Seeded, so every run sows the same coral
    return createDemoModel({ random: createRandom({ seed: 1 }), cols: COLS, rows: ROWS });
}

function run(model: DemoModel, totalMs: number): void {
    for (let ms = 0; ms < totalMs; ms += 16) model.update(16);
}

function totalGrowth(model: DemoModel): number {
    let total = 0;
    for (let i = 0; i < CELLS; i++) total += model.growthAt(i);
    return total;
}
