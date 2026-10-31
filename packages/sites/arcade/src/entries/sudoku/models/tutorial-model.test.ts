import { describe, expect, it } from 'vitest';
import { countDigits, hasDigit, loadSudokuGenerator } from '#sudoku-digger';
import { PRACTICE_LEVEL, PRACTICE_SEED } from './model-constants';
import { createPuzzleModel, type PuzzleModel } from './puzzle-model';
import { createTutorialModel, type TutorialModel, type TutorialStep, TUTORIAL_STEPS } from './tutorial-model';

const generateSudoku = await loadSudokuGenerator();
// The practice puzzle, which the tutorial plays on
const { givens, solution } = generateSudoku({ seed: PRACTICE_SEED, level: PRACTICE_LEVEL });
const CELL = givens.findIndex((digit, cell) => digit === 0 && cell % 9 < 8 && givens[cell + 1] === 0);

describe('TutorialModel', () => {
    it('waits at a step until the player has done what it asks', () => {
        const puzzle = createPuzzleModel({ givens, solution });
        const tutorial = createTutorialModel({ puzzle, solution });
        tutorial.update(16);
        expect(tutorial.step).toBe('select');
        puzzle.select([CELL]);
        tutorial.update(16);
        expect(tutorial.step).toBe('mark');
        // One pencil mark isn't enough: the step asks for two
        puzzle.toggleNote(1);
        tutorial.update(16);
        expect(tutorial.step).toBe('mark');
        expect(tutorial.stepNumber).toBe(2);
    });

    it('moves on one step at each update, even when the player is ahead of it', () => {
        const puzzle = createPuzzleModel({ givens, solution });
        const tutorial = createTutorialModel({ puzzle, solution });
        // A cell selected with two marks already does what the first two steps ask
        puzzle.select([CELL]);
        puzzle.toggleNote(1);
        puzzle.toggleNote(2);
        tutorial.update(16);
        expect(tutorial.step).toBe('mark');
        tutorial.update(16);
        expect(tutorial.step).toBe('link');
        tutorial.update(16);
        expect(tutorial.step).toBe('link');
        expect(tutorial.stepNumber).toBe(TUTORIAL_STEPS.indexOf('link') + 1);
    });

    describe('its demos', () => {
        it('show selecting an empty cell that two digits could go in', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            const tutorial = createTutorialModel({ puzzle, solution });
            expect(tutorial.demo).toBe('select');
            const [cell] = tutorial.demoCells;
            expect(puzzle.digitAt(cell)).toBe(0);
            expect(countDigits(puzzle.candidatesAt(cell))).toBeGreaterThanOrEqual(2);
        });

        it('show pencilling in digits that could go in the cell selected, and only those still to do', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            const tutorial = createTutorialModel({ puzzle, solution });
            puzzle.select([tutorial.demoCells[0]]);
            tutorial.update(16);
            expect(tutorial.demo).toBe('note');
            const [first, second] = tutorial.demoDigits;
            const candidates = puzzle.candidatesAt(puzzle.selection[0]);
            expect([first, second].every((digit) => hasDigit(candidates, digit))).toBe(true);
            // Once one is in, the demo shows only the other, and starts over
            const shown = tutorial.demosShown;
            puzzle.toggleNote(first);
            tutorial.update(16);
            expect(tutorial.demoDigits).toEqual([second]);
            expect(tutorial.demosShown).toBe(shown + 1);
        });

        it('show linking two empty cells in one row, column or box, then noting digits they could both hold', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            const tutorial = createTutorialModel({ puzzle, solution });
            reachStep(puzzle, tutorial, 'link');
            expect(tutorial.demo).toBe('link');
            const [a, b] = tutorial.demoCells;
            expect(puzzle.digitAt(a) + puzzle.digitAt(b)).toBe(0);
            puzzle.select([a, b]);
            expect(puzzle.canNoteSelection).toBe(true);
            tutorial.update(16);
            tutorial.update(16);
            expect(tutorial.step).toBe('group');
            expect(tutorial.demo).toBe('note');
            const shared = puzzle.candidatesAt(a) & puzzle.candidatesAt(b);
            expect(tutorial.demoDigits.every((digit) => hasDigit(shared, digit))).toBe(true);
        });

        it('show filling a cell in with its solution\'s digit, and then nothing at the last step', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            const tutorial = createTutorialModel({ puzzle, solution });
            reachStep(puzzle, tutorial, 'fill');
            expect(tutorial.demo).toBe('fill');
            const [cell] = tutorial.demoCells;
            expect(puzzle.digitAt(cell)).toBe(0);
            expect(tutorial.demoDigits).toEqual([solution[cell]]);
            puzzle.fillCell(cell, solution[cell]);
            tutorial.update(16);
            tutorial.update(16);
            expect(tutorial.demo).toBe('none');
        });
    });
});

/** Does what each step asks, as its demo shows, until the tutorial is at `step`. */
function reachStep(puzzle: PuzzleModel, tutorial: TutorialModel, step: TutorialStep): void {
    for (let i = 0; i < TUTORIAL_STEPS.length && tutorial.step !== step; i++) {
        if (tutorial.demo === 'select' || tutorial.demo === 'link') puzzle.select(tutorial.demoCells);
        for (const digit of tutorial.demoDigits) puzzle.toggleNote(digit);
        tutorial.update(16);
        tutorial.update(16);
    }
    expect(tutorial.step).toBe(step);
}
