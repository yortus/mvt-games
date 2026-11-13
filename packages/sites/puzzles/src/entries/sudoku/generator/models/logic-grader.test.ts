import { describe, expect, it } from 'vitest';
import { createLogicGrader, type LogicGrader, TECHNIQUES } from './logic-grader';
import {
    checkGraderSteps, findAllowedDigits, FULL_GRID, isValidGrid, makePuzzle, SINGLES_PUZZLE,
} from './test-grids.test-support';

describe('the logic grader', () => {
    it('solves a puzzle that singles solve, with singles alone', () => {
        const grader = createLogicGrader();
        grader.start(SINGLES_PUZZLE);
        runToEnd(grader);
        expect(grader.status).toBe('solved');
        expect(isValidGrid(grader.digits)).toBe(true);
        expect(grader.hardest).toBe('naked-single');
        expect(grader.placements).toBe(countEmpty(SINGLES_PUZZLE));
        expect(grader.reductions).toBe(0);
    });

    it('fills in the pencil marks as it starts: every digit that breaks no rule in each empty cell', () => {
        const grader = createLogicGrader();
        grader.start(SINGLES_PUZZLE);
        for (let cell = 0; cell < 81; cell++) {
            expect(grader.candidates[cell]).toBe(SINGLES_PUZZLE[cell] === 0 ? findAllowedDigits(SINGLES_PUZZLE, cell) : 0);
        }
    });

    it('places the one digit that fits, and rubs it out of its peers\' pencil marks', () => {
        const puzzle = new Uint8Array(FULL_GRID);
        puzzle[0] = 0;
        puzzle[40] = 0;
        const grader = createLogicGrader();
        grader.start(puzzle);
        grader.step();
        expect(grader.lastTechnique).toBe('naked-single');
        expect(grader.lastCell).toBe(0);
        expect(grader.digits[0]).toBe(FULL_GRID[0]);
        expect(grader.isHighlightedAt(0)).toBe(true);
    });

    it('is stuck at once on an empty grid, where no technique makes progress', () => {
        const grader = createLogicGrader();
        grader.start(new Uint8Array(81));
        grader.step();
        expect(grader.status).toBe('stuck');
        expect(grader.lastTechnique).toBeUndefined();
    });

    // A sample: logic-grader.slow.test.ts checks 12 puzzles, enough to see
    // more than singles.
    it('never places a wrong digit, nor rubs out a right one, in a hard puzzle and a hardest one', () => {
        const { ambiguous, mistakes } = checkGraderSteps([1, 2]);
        expect(ambiguous).toEqual([]);
        expect(mistakes).toEqual([]);
    });

    it('keeps its hardest technique as the hardest of its steps, in the order of TECHNIQUES', () => {
        const grader = createLogicGrader();
        grader.start(makePuzzle(4, 'hardest'));
        let hardest = -1;
        while (grader.status === 'solving') {
            grader.step();
            if (grader.lastTechnique !== undefined) hardest = Math.max(hardest, TECHNIQUES.indexOf(grader.lastTechnique));
            expect(grader.hardest).toBe(TECHNIQUES[hardest]);
        }
    });
});

function runToEnd(grader: LogicGrader): void {
    while (grader.status === 'solving') grader.step();
}

function countEmpty(grid: Readonly<Uint8Array>): number {
    let count = 0;
    for (let cell = 0; cell < 81; cell++) {
        if (grid[cell] === 0) count++;
    }
    return count;
}
