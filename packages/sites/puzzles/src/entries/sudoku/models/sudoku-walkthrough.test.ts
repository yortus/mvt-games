import { describe, expect, it } from 'vitest';
import { createWalkthroughModel, type WalkthroughModel } from '../../../shared';
import { countDigits, hasDigit, loadSudokuGenerator } from '../generator';
import { PRACTICE_LEVEL, PRACTICE_SEED } from './model-constants';
import { createPuzzleModel, type PuzzleModel } from './puzzle-model';
import { SUDOKU_WALKTHROUGH, type SudokuTarget } from './sudoku-walkthrough';

const generateSudoku = await loadSudokuGenerator();
// The practice puzzle, which the walkthrough plays on
const { givens, solution } = generateSudoku({ seed: PRACTICE_SEED, level: PRACTICE_LEVEL });

describe('Sudoku\'s walkthrough', () => {
    it('shows selecting an empty cell that two digits could go in', () => {
        const { puzzle, walkthrough } = setUp();
        expect(walkthrough.stepName).toBe('select');
        expect(walkthrough.demo.map((touch) => touch.kind)).toEqual(['tap']);
        const [cell] = listCells(walkthrough);
        expect(puzzle.digitAt(cell)).toBe(0);
        expect(countDigits(puzzle.candidatesAt(cell))).toBeGreaterThanOrEqual(2);
    });

    it('waits for two pencil marks, showing digits that could go in the cell selected, and only those still to do', () => {
        const { puzzle, walkthrough } = setUp();
        puzzle.select(listCells(walkthrough));
        walkthrough.update(16);
        expect(walkthrough.stepName).toBe('mark');
        const [first, second] = listDigits(walkthrough);
        const candidates = puzzle.candidatesAt(puzzle.selection[0]);
        expect([first, second].every((digit) => hasDigit(candidates, digit))).toBe(true);
        // Once one is in, the demo shows only the other, and starts over
        const shown = walkthrough.demosShown;
        puzzle.toggleNote(first);
        walkthrough.update(16);
        expect(walkthrough.stepName).toBe('mark');
        expect(listDigits(walkthrough)).toEqual([second]);
        expect(walkthrough.demosShown).toBe(shown + 1);
    });

    it('shows linking two empty cells in one row, column or box, then noting digits they could both hold', () => {
        const { puzzle, walkthrough } = setUp();
        reachStep(puzzle, walkthrough, 'link');
        expect(walkthrough.demo.map((touch) => touch.kind)).toEqual(['drag']);
        const [a, b] = listCells(walkthrough);
        expect(puzzle.digitAt(a) + puzzle.digitAt(b)).toBe(0);
        puzzle.select([a, b]);
        expect(puzzle.canNoteSelection).toBe(true);
        walkthrough.update(16);
        walkthrough.update(16);
        expect(walkthrough.stepName).toBe('group');
        const shared = puzzle.candidatesAt(a) & puzzle.candidatesAt(b);
        expect(listDigits(walkthrough).every((digit) => hasDigit(shared, digit))).toBe(true);
    });

    it('shows filling a cell in with its solution\'s digit, named in its text, and then nothing at the last step', () => {
        const { puzzle, walkthrough } = setUp();
        reachStep(puzzle, walkthrough, 'fill');
        expect(walkthrough.demo.map((touch) => touch.kind)).toEqual(['tap', 'hold']);
        const [cell] = listCells(walkthrough);
        expect(puzzle.digitAt(cell)).toBe(0);
        expect(listDigits(walkthrough)).toEqual([solution[cell]]);
        expect(walkthrough.text).toContain(`Only a ${solution[cell]} can go`);
        puzzle.fillCell(cell, solution[cell]);
        walkthrough.update(16);
        expect(walkthrough.stepName).toBe('done');
        expect(walkthrough.isAtLastStep).toBe(true);
        expect(walkthrough.demo).toEqual([]);
    });
});

function setUp(): { puzzle: PuzzleModel; walkthrough: WalkthroughModel<SudokuTarget> } {
    const puzzle = createPuzzleModel({ givens, solution });
    return { puzzle, walkthrough: createWalkthroughModel({ practice: { puzzle, solution }, ...SUDOKU_WALKTHROUGH }) };
}

/** The cells the demo touches, in order. */
function listCells(walkthrough: WalkthroughModel<SudokuTarget>): number[] {
    return walkthrough.demo.flatMap((touch) => touch.targets).flatMap((target) => (target.on === 'cell' ? [target.cell] : []));
}

/** The digits whose keys the demo touches, in order. */
function listDigits(walkthrough: WalkthroughModel<SudokuTarget>): number[] {
    return walkthrough.demo.flatMap((touch) => touch.targets).flatMap((target) => (target.on === 'key' ? [target.digit] : []));
}

/** Does what each step's demo shows, until the walkthrough is at `step`. */
function reachStep(puzzle: PuzzleModel, walkthrough: WalkthroughModel<SudokuTarget>, step: string): void {
    for (let i = 0; i < 10 && walkthrough.stepName !== step; i++) {
        const cells = listCells(walkthrough);
        if (cells.length > 0) puzzle.select(cells);
        for (const digit of listDigits(walkthrough)) puzzle.toggleNote(digit);
        walkthrough.update(16);
        walkthrough.update(16);
    }
    expect(walkthrough.stepName).toBe(step);
}
