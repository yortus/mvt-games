import { describe, expect, it } from 'vitest';
import { CELL_COUNT } from '../sudoku-grid';
import { createGridShuffler, type ShuffleKind } from './grid-shuffler';
import { SHUFFLE_COUNT } from './model-constants';
import { createRandom } from './random';
import { FULL_GRID, isValidGrid } from './test-grids.test-support';

describe('the grid shuffler', () => {
    it('shuffles the full grid, the puzzle and the marks the same way, a shuffle a step, keeping each valid', () => {
        const { shuffler, solution, puzzle, marks } = setUp();
        const kinds: (ShuffleKind | undefined)[] = [];
        while (!shuffler.isDone) {
            shuffler.step();
            kinds.push(shuffler.kind);
            expect(isValidGrid(solution)).toBe(true);
            for (let cell = 0; cell < CELL_COUNT; cell++) {
                // Each given is still the full grid's digit, and a dug cell's mark goes with it
                if (puzzle[cell] !== 0) expect(puzzle[cell]).toBe(solution[cell]);
                expect(marks[cell] === 1).toBe(puzzle[cell] === 0);
            }
        }
        expect(shuffler.count).toBe(SHUFFLE_COUNT);
        expect(kinds).toEqual(['digits', 'columns', 'stacks', 'turn'].slice(0, SHUFFLE_COUNT));
    });

    it('swaps two different things, the smaller first', () => {
        const { shuffler } = setUp();
        while (!shuffler.isDone) {
            shuffler.step();
            if (shuffler.kind === 'turn') continue;
            expect(shuffler.first).toBeLessThan(shuffler.second);
        }
    });
});

function setUp() {
    const solution = new Uint8Array(FULL_GRID);
    // The full grid with every fourth cell dug out, and each of those marked as dug
    const puzzle = FULL_GRID.map((digit, cell) => (cell % 4 === 0 ? 0 : digit));
    const marks = puzzle.map((digit) => (digit === 0 ? 1 : 0));
    const shuffler = createGridShuffler({ random: createRandom({ seed: 4 }), solution, puzzle, marks });
    return { shuffler, solution, puzzle, marks };
}
