import type { Random } from './random';
import { ALL_DIGITS, BOX_OF, CELL_COUNT, COLUMN_OF, countDigits, lowestDigit, pickDigit, ROW_OF, toDigitSet } from './sudoku-rules';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Whether a search is still going, has found a solution, or has shown there is none. */
export type SearchStatus = 'searching' | 'solved' | 'impossible';

/**
 * What the search's last move was. A try puts a digit in a cell. A retreat
 * takes one out when no other digit is left to try there.
 */
export type SearchMove = 'none' | 'try' | 'retreat';

/** Which digit the search tries first in a cell: the smallest, or one picked at random. */
export type DigitOrder = 'lowest-first' | 'random';

/**
 * A depth-first search for a solution, one move at a time, so each move can
 * be watched. It fills the empty cell with the fewest digits that could go
 * there, trying each in turn. When a cell has none, it backs up to the last
 * cell that still has a digit to try. It keeps its own stack rather than
 * calling itself, so it can stop after any move, and it allocates nothing
 * as it goes.
 */
export interface StepSolver {
    /** The grid as the search has it: the givens, and the digits it has placed. */
    readonly digits: Readonly<Uint8Array>;
    readonly status: SearchStatus;
    /** Moves made since the search started, tries and retreats together. */
    readonly steps: number;
    /** Digits placed since the search started. */
    readonly tries: number;
    /** Digits taken out since the search started, at dead ends. */
    readonly retreats: number;
    readonly lastMove: SearchMove;
    /** The cell of the last move, or -1 before the first. */
    readonly lastCell: number;
    /** The digit the last move placed, or took out. */
    readonly lastDigit: number;
    /** Whether `cell` was filled when the search started. */
    isGivenAt: (cell: number) => boolean;
    /** Starts a new search from `givens`, which must break no rule. Empty cells are 0. */
    start: (givens: Readonly<Uint8Array>, order: DigitOrder) => void;
    /** Makes the next move, if the search is still going. */
    step: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface StepSolverOptions {
    /** Where the random digit order's choices come from. */
    readonly random: Random;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a search with nothing to search yet. Call `start` to give it a grid. */
export function createStepSolver(options: StepSolverOptions): StepSolver {
    const { random } = options;
    const digits = new Uint8Array(CELL_COUNT);
    const isGiven = new Uint8Array(CELL_COUNT);
    // The stack: each cell the search has filled, in order, and the digits it has still to try there
    const stackCells = new Uint8Array(CELL_COUNT);
    const stackLeft = new Uint16Array(CELL_COUNT);
    // The digits each row, column and box holds, kept as the search goes, so a cell's choices take three lookups
    const rowUsed = new Uint16Array(9);
    const columnUsed = new Uint16Array(9);
    const boxUsed = new Uint16Array(9);
    let depth = 0;
    let filledCount = 0;
    let isBackingUp = false;
    let order: DigitOrder = 'lowest-first';
    let status: SearchStatus = 'solved';
    let steps = 0;
    let tries = 0;
    let retreats = 0;
    let lastMove: SearchMove = 'none';
    let lastCell = -1;
    let lastDigit = 0;

    const solver: StepSolver = {
        digits,
        get status() { return status; },
        get steps() { return steps; },
        get tries() { return tries; },
        get retreats() { return retreats; },
        get lastMove() { return lastMove; },
        get lastCell() { return lastCell; },
        get lastDigit() { return lastDigit; },
        isGivenAt: (cell) => isGiven[cell] === 1,
        start,
        step,
    };
    return solver;

    function start(givens: Readonly<Uint8Array>, digitOrder: DigitOrder): void {
        digits.set(givens);
        filledCount = 0;
        rowUsed.fill(0);
        columnUsed.fill(0);
        boxUsed.fill(0);
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            isGiven[cell] = givens[cell] === 0 ? 0 : 1;
            filledCount += isGiven[cell];
            if (givens[cell] !== 0) markUsed(cell, givens[cell]);
        }
        order = digitOrder;
        depth = 0;
        isBackingUp = false;
        status = filledCount === CELL_COUNT ? 'solved' : 'searching';
        steps = 0;
        tries = 0;
        retreats = 0;
        lastMove = 'none';
        lastCell = -1;
        lastDigit = 0;
    }

    function step(): void {
        if (status !== 'searching') return;
        steps++;
        if (isBackingUp) {
            backUp();
            return;
        }
        // The empty cell with the fewest digits that could go in it. A cell with none is a dead end, and
        // one with a single digit is as good as any, so the look stops at either
        let bestCell = -1;
        let bestSet = 0;
        let bestCount = 10;
        for (let cell = 0; cell < CELL_COUNT && bestCount > 1; cell++) {
            if (digits[cell] !== 0) continue;
            const set = ALL_DIGITS & ~(rowUsed[ROW_OF[cell]] | columnUsed[COLUMN_OF[cell]] | boxUsed[BOX_OF[cell]]);
            const count = countDigits(set);
            if (count < bestCount) {
                bestCell = cell;
                bestSet = set;
                bestCount = count;
            }
        }
        if (bestCount === 0) {
            isBackingUp = true;
            backUp();
            return;
        }
        stackCells[depth] = bestCell;
        stackLeft[depth] = bestSet;
        depth++;
        tryNextDigit();
    }

    /** Takes out the digit on top of the stack, and tries the cell's next digit, or gives the cell up if it has none. */
    function backUp(): void {
        if (depth === 0) {
            status = 'impossible';
            lastMove = 'none';
            return;
        }
        const cell = stackCells[depth - 1];
        lastDigit = digits[cell];
        digits[cell] = 0;
        clearUsed(cell, lastDigit);
        filledCount--;
        if (stackLeft[depth - 1] !== 0) {
            isBackingUp = false;
            tryNextDigit();
            return;
        }
        depth--;
        retreats++;
        lastMove = 'retreat';
        lastCell = cell;
    }

    /** Puts the next digit still to try into the cell on top of the stack. */
    function tryNextDigit(): void {
        const top = depth - 1;
        const left = stackLeft[top];
        const digit = order === 'random' ? pickDigit(left, Math.floor(random.next() * countDigits(left))) : lowestDigit(left);
        stackLeft[top] = left & ~toDigitSet(digit);
        const cell = stackCells[top];
        digits[cell] = digit;
        markUsed(cell, digit);
        filledCount++;
        tries++;
        lastMove = 'try';
        lastCell = cell;
        lastDigit = digit;
        if (filledCount === CELL_COUNT) status = 'solved';
    }

    function markUsed(cell: number, digit: number): void {
        const bit = toDigitSet(digit);
        rowUsed[ROW_OF[cell]] |= bit;
        columnUsed[COLUMN_OF[cell]] |= bit;
        boxUsed[BOX_OF[cell]] |= bit;
    }

    function clearUsed(cell: number, digit: number): void {
        const bit = ~toDigitSet(digit);
        rowUsed[ROW_OF[cell]] &= bit;
        columnUsed[COLUMN_OF[cell]] &= bit;
        boxUsed[BOX_OF[cell]] &= bit;
    }
}
