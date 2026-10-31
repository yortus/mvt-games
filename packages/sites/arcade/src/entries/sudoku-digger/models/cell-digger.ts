import { CELL_COUNT, COLUMN_OF, findCandidates, type Level, lowestDigit, ROW_OF, toDigitSet } from '../sudoku-grid';
import { type CellEvent, createCellEventLog } from './cell-event';
import { LEVEL_SETTINGS } from './model-constants';
import type { Random } from './random';
import type { SearchLog } from './search-log';
import type { StepSolver } from './step-solver';
import { writeDigOrder } from './write-dig-order';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What digging made of a cell: dug out, needed (another digit there would
 * give a second solution), or held (its row or column can't spare another
 * given). `none` is a cell not yet tried, or kept because the puzzle
 * reached its target first.
 */
export type DigMark = 'none' | 'dug' | 'needed' | 'held';

/** Digging cells out of the full grid, as a view sees it. */
export interface CellDigging {
    /** The cell being dug, or -1. */
    readonly focusCell: number;
    /** The digit the cell being dug held in the full grid. */
    readonly originalDigit: number;
    /** The other digit being tried in the cell being dug, or 0. */
    readonly testDigit: number;
    /** The cell whose other digits are being tried, from the moment it is emptied to the verdict on it, or -1. */
    readonly testedCell: number;
    /** The digits other than its own that could go in the tested cell, each to be tried. */
    readonly rivalDigits: number;
    /** The rival digits tried so far that led nowhere. */
    readonly ruledOutDigits: number;
    /** Rival digits tried in cells being dug. */
    readonly testsRun: number;
    /** Rival digits tried that led nowhere, at the cell being dug. */
    readonly failedTests: CellEvent;
    /** Cells dug out, with the digit each held. */
    readonly dug: CellEvent;
    /** Cells found needed, with the digit each keeps. */
    readonly needed: CellEvent;
    /** Cells held because a row or column could spare no more givens, with the digit each keeps. */
    readonly held: CellEvent;
    /** How many givens the puzzle has. */
    readonly givensCount: number;
    /** The fewest givens this puzzle keeps, chosen as digging starts, or 0 before. */
    readonly givensTarget: number;
    /** The fewest givens any row or column keeps, for this level. */
    readonly fewestPerLine: number;
    givensInRow: (row: number) => number;
    givensInColumn: (column: number) => number;
    digMarkAt: (cell: number) => DigMark;
}

/**
 * Digs a puzzle out of a full grid, a cell at a time, in its level's
 * order. A cell is dug out if no other digit there leads to a solution, so
 * the puzzle keeps exactly one. Each other digit is tested with a search
 * from the puzzle as it stands. A cell stays if its row or column can't
 * spare another given, or if another digit leads to a second solution.
 * Digging stops when the puzzle comes down to its target, or every cell has
 * been tried.
 */
export interface CellDigger extends CellDigging {
    /** Whether the grid on show is the search's, testing a rival digit, rather than the puzzle. */
    readonly isShowingSearch: boolean;
    /** Whether digging has stopped. */
    readonly isDone: boolean;
    /** Leaves the puzzle empty and nothing dug, for a new puzzle at `level`. Its counts are cleared apart, with `clearCounts`. */
    reset: (level: Level) => void;
    /** Sets the counts back to nothing, and leaves the puzzle as it is, as the puzzles tried out of sight do. */
    clearCounts: () => void;
    /** Starts digging the full grid it was given, choosing the order and the target. */
    start: () => void;
    /** Takes the next step, and says what it did. */
    step: () => DigStepKind;
    /** Counts the puzzle's givens again, row by row and column by column, after something else moved them. */
    countGivens: () => void;
}

/** The steps digging takes. See `StepKind`. */
export type DigStepKind =
    | 'dig-chosen' | 'dig-held' | 'dig-only-digit' | 'dig-testing' | 'search-tried' | 'search-retreated' | 'dig-test-failed'
    | 'dig-needed' | 'dig-dug' | 'dig-enough' | 'dig-done';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CellDiggerOptions {
    /** Where the dig order, and the target, come from. */
    readonly random: Random;
    /** The search, which the digger shares with the other stages. */
    readonly solver: StepSolver;
    /** Where the search's moves are recorded. */
    readonly search: SearchLog;
    /** The full grid, which `start` digs from. */
    readonly solution: Readonly<Uint8Array>;
    /** The puzzle the digger digs, and each cell's mark. They are the model's, which the shuffles move about too. */
    readonly puzzle: Uint8Array;
    readonly marks: Uint8Array;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a digger with nothing to dig yet. */
export function createCellDigger(options: CellDiggerOptions): CellDigger {
    const { random, solver, search, solution, puzzle, marks } = options;
    const digOrder = new Uint8Array(CELL_COUNT);
    const rowGivens = new Uint8Array(9);
    const columnGivens = new Uint8Array(9);
    const failedTests = createCellEventLog();
    const dug = createCellEventLog();
    const needed = createCellEventLog();
    const held = createCellEventLog();

    let level: Level = 'easy';
    let stage: 'choose' | 'check' | 'next-test' | 'test' = 'choose';
    let isDone = true;
    let digIndex = 0;
    let focusCell = -1;
    let originalDigit = 0;
    let testDigit = 0;
    let digitsToTest = 0;
    let testedCell = -1;
    let rivalDigits = 0;
    let ruledOutDigits = 0;
    let testsRun = 0;
    let isShowingSearch = false;
    let givensCount = 0;
    let givensTarget = 0;

    return {
        get focusCell() { return focusCell; },
        get originalDigit() { return originalDigit; },
        get testDigit() { return testDigit; },
        get testedCell() { return testedCell; },
        get rivalDigits() { return rivalDigits; },
        get ruledOutDigits() { return ruledOutDigits; },
        get testsRun() { return testsRun; },
        failedTests,
        dug,
        needed,
        held,
        get givensCount() { return givensCount; },
        get givensTarget() { return givensTarget; },
        get fewestPerLine() { return LEVEL_SETTINGS[level].fewestPerLine; },
        givensInRow: (row) => rowGivens[row],
        givensInColumn: (column) => columnGivens[column],
        digMarkAt: (cell) => DIG_MARKS[marks[cell]],
        get isShowingSearch() { return isShowingSearch; },
        get isDone() { return isDone; },
        reset(next) {
            level = next;
            isDone = true;
            puzzle.fill(0);
            marks.fill(0);
            givensTarget = 0;
            countGivens();
        },
        clearCounts,
        start() {
            puzzle.set(solution);
            const settings = LEVEL_SETTINGS[level];
            writeDigOrder(digOrder, settings.digOrder, random);
            digIndex = 0;
            givensTarget = settings.fewestGivens + Math.floor(random.next() * (settings.mostGivens - settings.fewestGivens + 1));
            countGivens();
            stage = 'choose';
            isDone = false;
        },
        step() {
            switch (stage) {
                case 'choose': return chooseCell();
                case 'check': return checkCell();
                case 'next-test': return startNextTest();
                case 'test': return runTest();
            }
        },
        countGivens,
    };

    function clearCounts(): void {
        focusCell = -1;
        originalDigit = 0;
        testDigit = 0;
        testedCell = -1;
        rivalDigits = 0;
        ruledOutDigits = 0;
        isShowingSearch = false;
        testsRun = 0;
        failedTests.reset();
        dug.reset();
        needed.reset();
        held.reset();
    }

    function chooseCell(): DigStepKind {
        isShowingSearch = false;
        testDigit = 0;
        testedCell = -1;
        rivalDigits = 0;
        ruledOutDigits = 0;
        if (givensCount <= givensTarget || digIndex === CELL_COUNT) {
            focusCell = -1;
            isDone = true;
            return givensCount <= givensTarget ? 'dig-enough' : 'dig-done';
        }
        focusCell = digOrder[digIndex++];
        originalDigit = puzzle[focusCell];
        stage = 'check';
        return 'dig-chosen';
    }

    function checkCell(): DigStepKind {
        const fewest = LEVEL_SETTINGS[level].fewestPerLine;
        if (rowGivens[ROW_OF[focusCell]] <= fewest || columnGivens[COLUMN_OF[focusCell]] <= fewest) {
            marks[focusCell] = HELD;
            held.record(focusCell, originalDigit);
            stage = 'choose';
            return 'dig-held';
        }
        // Empty the cell, and see which other digits could go there
        puzzle[focusCell] = 0;
        digitsToTest = findCandidates(puzzle, focusCell) & ~toDigitSet(originalDigit);
        testedCell = focusCell;
        rivalDigits = digitsToTest;
        if (digitsToTest === 0) {
            digOut();
            return 'dig-only-digit';
        }
        return startNextTest();
    }

    /** Puts the next digit to test into the cell being dug, and starts a search from there. */
    function startNextTest(): DigStepKind {
        testDigit = lowestDigit(digitsToTest);
        digitsToTest &= ~toDigitSet(testDigit);
        puzzle[focusCell] = testDigit;
        solver.start(puzzle, 'lowest-first');
        puzzle[focusCell] = 0;
        testsRun++;
        isShowingSearch = true;
        stage = 'test';
        return 'dig-testing';
    }

    function runTest(): DigStepKind {
        if (solver.status === 'searching') {
            solver.step();
            const move = search.recordMove(solver);
            if (move !== undefined) return move;
        }
        if (solver.status === 'solved') {
            // A second solution: the cell must keep its digit. The search's solution stays on show while the step holds
            puzzle[focusCell] = originalDigit;
            marks[focusCell] = NEEDED;
            needed.record(focusCell, originalDigit);
            stage = 'choose';
            return 'dig-needed';
        }
        isShowingSearch = false;
        ruledOutDigits |= toDigitSet(testDigit);
        failedTests.record(focusCell, testDigit);
        if (digitsToTest === 0) {
            digOut();
            return 'dig-dug';
        }
        stage = 'next-test';
        return 'dig-test-failed';
    }

    /** Leaves the cell being dug empty for good. */
    function digOut(): void {
        isShowingSearch = false;
        marks[focusCell] = DUG;
        dug.record(focusCell, originalDigit);
        countGivens();
        stage = 'choose';
    }

    function countGivens(): void {
        rowGivens.fill(0);
        columnGivens.fill(0);
        givensCount = 0;
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            if (puzzle[cell] === 0) continue;
            givensCount++;
            rowGivens[ROW_OF[cell]]++;
            columnGivens[COLUMN_OF[cell]]++;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// Each cell's mark, as a small number in the model's typed array
const DUG = 1;
const NEEDED = 2;
const HELD = 3;
const DIG_MARKS: readonly DigMark[] = ['none', 'dug', 'needed', 'held'];
