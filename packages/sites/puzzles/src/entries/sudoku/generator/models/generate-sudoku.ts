import { CELL_COUNT, type Level } from '../sudoku-grid';
import { createDiggerModel } from './digger-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A puzzle made by `generateSudoku`. Its cells are listed row by row, from the top left. */
export interface GeneratedSudoku {
    /** The puzzle's 81 cells: the digit given in each, or 0 for a cell to fill in. */
    readonly givens: readonly number[];
    /** Its one solution, in every cell. */
    readonly solution: readonly number[];
    /**
     * The level it came out at, by the hardest technique it needs. That is the
     * level asked for, unless none of the puzzles tried came out at it, and
     * then it is the nearest.
     */
    readonly grade: Level;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GenerateSudokuOptions {
    /** Any whole number. The same seed and level always make the same puzzle. */
    readonly seed: number;
    /** The level to make it at. */
    readonly level: Level;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Makes a Sudoku puzzle with one solution, at a level of difficulty, the way
 * Sudoku Digger shows it being made, but at once and out of sight. An
 * Easiest puzzle takes a millisecond or so, and a harder one a few tens of
 * milliseconds, though now and then one takes as long as a fifth of a second.
 */
export function generateSudoku(options: GenerateSudokuOptions): GeneratedSudoku {
    const model = createDiggerModel({ seed: options.seed, level: options.level });
    model.finishNow();
    model.update(0);
    const grade = model.grade;
    if (grade === undefined) throw new Error('The puzzle was not finished');

    const givens: number[] = [];
    const solution: number[] = [];
    for (let cell = 0; cell < CELL_COUNT; cell++) {
        givens.push(model.digitAt(cell));
        solution.push(model.fullGridDigitAt(cell));
    }
    return { givens, solution, grade };
}
