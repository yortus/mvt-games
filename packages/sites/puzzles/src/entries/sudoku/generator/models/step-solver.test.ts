import { describe, expect, it } from 'vitest';
import { createRandom, type Random } from './random';
import { createStepSolver, type StepSolver } from './step-solver';
import { countSolutions, findAllowedDigits, FULL_GRID, isValidGrid, parseGrid, SINGLES_PUZZLE } from './test-grids.test-support';

describe('the step-at-a-time search', () => {
    it('solves a puzzle, keeping its givens', () => {
        const solver = createStepSolver({ random: createRandom({ seed: 1 }) });
        solver.start(SINGLES_PUZZLE, 'lowest-first');
        runToEnd(solver);
        expect(solver.status).toBe('solved');
        expect(isValidGrid(solver.digits)).toBe(true);
        expect(solver.digits.includes(0)).toBe(false);
        for (let cell = 0; cell < 81; cell++) {
            if (SINGLES_PUZZLE[cell] !== 0) expect(solver.digits[cell]).toBe(SINGLES_PUZZLE[cell]);
            expect(solver.isGivenAt(cell)).toBe(SINGLES_PUZZLE[cell] !== 0);
        }
    });

    it('fills an empty grid with a valid one, in a random order', () => {
        const solver = createStepSolver({ random: createRandom({ seed: 2 }) });
        solver.start(new Uint8Array(81), 'random');
        runToEnd(solver);
        expect(solver.status).toBe('solved');
        expect(isValidGrid(solver.digits)).toBe(true);
    });

    it('finds the same grid for the same seed, and a different one for another', () => {
        const fill = (seed: number) => {
            const solver = createStepSolver({ random: createRandom({ seed }) });
            solver.start(new Uint8Array(81), 'random');
            runToEnd(solver);
            return Array.from(solver.digits).join('');
        };
        expect(fill(3)).toBe(fill(3));
        expect(fill(3)).not.toBe(fill(4));
    });

    it('shows a puzzle has no solution, though its givens break no rule', () => {
        // The top row needs a 9 in its last cell, but the 9 below it blocks that column
        const puzzle = parseGrid('12345678.' + '........9' + '.'.repeat(63));
        expect(countSolutions(puzzle)).toBe(0);
        const solver = createStepSolver({ random: createRandom({ seed: 5 }) });
        solver.start(puzzle, 'lowest-first');
        runToEnd(solver);
        expect(solver.status).toBe('impossible');
        expect(solver.tries).toBe(0);
    });

    it('backs up at dead ends, and counts every move as a try or a retreat', () => {
        // Grids filled from a few random digits, as the digger fills them, often meet dead ends
        let retreats = 0;
        for (let seed = 1; seed <= 20; seed++) {
            const random = createRandom({ seed });
            const solver = createStepSolver({ random });
            solver.start(scatterDigits(random, 11), 'random');
            while (solver.status === 'searching' && solver.steps < 5000) solver.step();
            retreats += solver.retreats;
            expect(solver.steps).toBe(solver.tries + solver.retreats + (solver.status === 'impossible' ? 1 : 0));
        }
        expect(retreats).toBeGreaterThan(0);
    });

    it('makes one move at a time: a try puts a digit in, a retreat takes one out', () => {
        const solver = createStepSolver({ random: createRandom({ seed: 6 }) });
        solver.start(SINGLES_PUZZLE, 'lowest-first');
        expect(solver.lastMove).toBe('none');
        let filled = countFilled(solver.digits);
        while (solver.status === 'searching') {
            solver.step();
            const now = countFilled(solver.digits);
            if (solver.lastMove === 'try') {
                expect(now).toBe(filled + 1);
                expect(solver.digits[solver.lastCell]).toBe(solver.lastDigit);
            }
            if (solver.lastMove === 'retreat') expect(now).toBe(filled - 1);
            filled = now;
        }
    });

    it('is solved at once when the grid it is given is full', () => {
        const solver = createStepSolver({ random: createRandom({ seed: 7 }) });
        solver.start(FULL_GRID, 'lowest-first');
        expect(solver.status).toBe('solved');
        solver.step();
        expect(solver.steps).toBe(0);
    });
});

/** A grid with `count` random digits in random cells, breaking no rule. */
function scatterDigits(random: Random, count: number): Uint8Array {
    const grid = new Uint8Array(81);
    for (let placed = 0; placed < count;) {
        const cell = Math.floor(random.next() * 81);
        const allowed = findAllowedDigits(grid, cell);
        if (grid[cell] !== 0 || allowed === 0) continue;
        const choices = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((digit) => (allowed & (1 << digit)) !== 0);
        grid[cell] = choices[Math.floor(random.next() * choices.length)];
        placed++;
    }
    return grid;
}

function runToEnd(solver: StepSolver): void {
    while (solver.status === 'searching') solver.step();
}

function countFilled(digits: Readonly<Uint8Array>): number {
    let count = 0;
    for (let cell = 0; cell < 81; cell++) {
        if (digits[cell] !== 0) count++;
    }
    return count;
}
