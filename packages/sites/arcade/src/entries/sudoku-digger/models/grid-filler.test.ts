import { describe, expect, it } from 'vitest';
import { CELL_COUNT } from '../sudoku-grid';
import { createGridFiller } from './grid-filler';
import { SEED_COUNT } from './model-constants';
import { createRandom } from './random';
import { createSearchLog } from './search-log';
import { createStepSolver } from './step-solver';
import { isValidGrid } from './test-grids.test-support';

describe('the grid filler', () => {
    it('places its seeds one a step, then searches from them until the grid is full', () => {
        const { filler, solver, search } = setUp(5);
        for (let i = 0; i < SEED_COUNT; i++) {
            expect(filler.step()).toBe('seed-placed');
            expect(filler.phase).toBe('seeding');
            expect(filler.seedDigits[filler.seeds.cell]).toBe(filler.seeds.digit);
        }
        expect(filler.seeds.count).toBe(SEED_COUNT);
        while (!filler.isFull) filler.step();
        expect(isValidGrid(solver.digits)).toBe(true);
        expect(search.tries.count).toBeGreaterThan(0);
        // Unless it gave up and seeded again, the grid keeps the seeds
        if (filler.restarts === 0) {
            for (let cell = 0; cell < CELL_COUNT; cell++) {
                if (filler.seedDigits[cell] !== 0) expect(solver.digits[cell]).toBe(filler.seedDigits[cell]);
            }
        }
    });

    it('seeds a new grid each time its search gives up', () => {
        for (let seed = 1; seed < 40; seed++) {
            const { filler } = setUp(seed);
            let gaveUp = 0;
            while (!filler.isFull) if (filler.step() === 'fill-gave-up') gaveUp++;
            expect(filler.restarts).toBe(gaveUp);
            expect(filler.seeds.count).toBe(SEED_COUNT * (gaveUp + 1));
        }
    });

    it('starts again from an empty grid, and its counts from nothing', () => {
        const { filler } = setUp(9);
        while (!filler.isFull) filler.step();
        filler.reset();
        filler.clearCounts();
        expect(filler.isFull).toBe(false);
        expect(filler.seedDigits.every((digit) => digit === 0)).toBe(true);
        expect([filler.seeds.count, filler.restarts]).toEqual([0, 0]);
        expect(filler.step()).toBe('seed-placed');
    });
});

function setUp(seed: number) {
    const random = createRandom({ seed });
    const solver = createStepSolver({ random });
    const search = createSearchLog();
    const filler = createGridFiller({ random, solver, search });
    return { filler, solver, search };
}
