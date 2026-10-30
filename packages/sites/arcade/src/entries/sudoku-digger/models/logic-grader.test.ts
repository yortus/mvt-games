import { describe, expect, it } from 'vitest';
import { createDiggerModel } from './digger-model';
import { createLogicGrader, type LogicGrader, TECHNIQUES } from './logic-grader';
import {
    countSolutions, findAllowedDigits, findSolution, FULL_GRID, isValidGrid, SINGLES_PUZZLE,
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

    it('never places a wrong digit, nor rubs out a right one, in puzzles of every level', () => {
        const usedTechniques = new Set<string>();
        for (let seed = 1; seed <= 12; seed++) {
            const puzzle = makePuzzle(seed, seed % 2 === 0 ? 'evil' : 'hard');
            expect(countSolutions(puzzle)).toBe(1);
            const solution = findSolution(puzzle) ?? puzzle;
            const grader = createLogicGrader();
            grader.start(puzzle);
            while (grader.status === 'solving') {
                grader.step();
                if (grader.lastTechnique !== undefined) usedTechniques.add(grader.lastTechnique);
                for (let cell = 0; cell < 81; cell++) {
                    if (grader.digits[cell] !== 0) expect(grader.digits[cell]).toBe(solution[cell]);
                    else expect(grader.candidates[cell] & (1 << solution[cell])).not.toBe(0);
                }
            }
        }
        // Enough puzzles to see more than singles, so the other techniques are checked too
        expect(usedTechniques.size).toBeGreaterThan(2);
    });

    it('keeps its hardest technique as the hardest of its steps, in the order of TECHNIQUES', () => {
        const grader = createLogicGrader();
        grader.start(makePuzzle(4, 'evil'));
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

/** A puzzle made by the digger model, for `level`, from `seed`. */
function makePuzzle(seed: number, level: 'hard' | 'evil'): Uint8Array {
    const model = createDiggerModel({ seed, level });
    model.playback = 'fast';
    while (model.phase !== 'grading') model.update(1000);
    // The grader's first step is the pencil marks, with only the givens shown
    const puzzle = new Uint8Array(81);
    for (let cell = 0; cell < 81; cell++) puzzle[cell] = model.cellKindAt(cell) === 'given' ? model.digitAt(cell) : 0;
    return puzzle;
}
