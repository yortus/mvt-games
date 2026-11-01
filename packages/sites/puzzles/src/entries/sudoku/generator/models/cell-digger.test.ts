import { describe, expect, it } from 'vitest';
import { CELL_COUNT, type Level, LEVELS } from '../sudoku-grid';
import { createCellDigger } from './cell-digger';
import { LEVEL_SETTINGS } from './model-constants';
import { createRandom } from './random';
import { createSearchLog } from './search-log';
import { createStepSolver } from './step-solver';
import { countSolutions, FULL_GRID } from './test-grids.test-support';

describe('the cell digger', () => {
    for (const level of LEVELS) {
        it(`digs a puzzle with one solution out of a full grid, within the ${level} level's limits`, () => {
            const { digger, puzzle } = setUp(level, 3);
            digger.start();
            while (!digger.isDone) digger.step();
            const settings = LEVEL_SETTINGS[level];
            expect(countSolutions(puzzle)).toBe(1);
            expect(digger.givensTarget).toBeGreaterThanOrEqual(settings.fewestGivens);
            expect(digger.givensTarget).toBeLessThanOrEqual(settings.mostGivens);
            expect(digger.givensCount).toBeGreaterThanOrEqual(digger.givensTarget);
            for (let line = 0; line < 9; line++) {
                expect(digger.givensInRow(line)).toBeGreaterThanOrEqual(settings.fewestPerLine);
                expect(digger.givensInColumn(line)).toBeGreaterThanOrEqual(settings.fewestPerLine);
            }
        });
    }

    it('marks each cell it digs, needs or holds, and counts each', () => {
        const { digger, puzzle } = setUp('hard', 7);
        digger.start();
        while (!digger.isDone) digger.step();
        const counts = { dug: 0, needed: 0, held: 0, none: 0 };
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            const mark = digger.digMarkAt(cell);
            counts[mark]++;
            expect(puzzle[cell] === 0).toBe(mark === 'dug');
            if (mark !== 'dug') expect(puzzle[cell]).toBe(FULL_GRID[cell]);
        }
        expect(counts.dug).toBe(digger.dug.count);
        expect(counts.needed).toBe(digger.needed.count);
        expect(counts.held).toBe(digger.held.count);
        expect(digger.givensCount).toBe(CELL_COUNT - counts.dug);
    });

    it('records the cell and digit of each cell it digs out', () => {
        const { digger } = setUp('easy', 11);
        digger.start();
        while (!digger.isDone) {
            const dug = digger.dug.count;
            digger.step();
            if (digger.dug.count === dug) continue;
            expect(digger.dug.cell).toBe(digger.focusCell);
            expect(digger.dug.digit).toBe(FULL_GRID[digger.dug.cell]);
        }
    });
});

function setUp(level: Level, seed: number) {
    const random = createRandom({ seed });
    const solver = createStepSolver({ random });
    const search = createSearchLog();
    const solution = new Uint8Array(FULL_GRID);
    const puzzle = new Uint8Array(CELL_COUNT);
    const marks = new Uint8Array(CELL_COUNT);
    const digger = createCellDigger({ random, solver, search, solution, puzzle, marks });
    digger.reset(level);
    return { digger, puzzle };
}
