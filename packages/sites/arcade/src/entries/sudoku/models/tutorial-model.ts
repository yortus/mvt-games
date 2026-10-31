import { ALL_DIGITS, CELL_COUNT, COLUMN_OF, countDigits, hasDigit, isSameUnit, ROW_OF } from '#sudoku-digger';
import type { PuzzleModel } from './puzzle-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A step of the tutorial. Each asks the player to do one thing, and is
 * done once they have:
 *
 * - `select`: select a cell.
 * - `mark`: pencil two digits into a cell.
 * - `link`: select two or more cells in one row, column or box.
 * - `group`: note two or more digits for them, as a group note.
 * - `fill`: fill a cell in.
 * - `done`: nothing more to do; the tutorial ends when the player says.
 */
export type TutorialStep = 'select' | 'mark' | 'link' | 'group' | 'fill' | 'done';

/** The steps, in order. */
export const TUTORIAL_STEPS: readonly TutorialStep[] = ['select', 'mark', 'link', 'group', 'fill', 'done'];

/**
 * What the tutorial shows the player how to do next, on the puzzle as it is:
 *
 * - `select`: select `demoCells[0]`.
 * - `note`: note `demoDigits` for the cells selected, one by one.
 * - `link`: link `demoCells`, two empty cells in one row, column or box.
 * - `fill`: fill `demoCells[0]` in with `demoDigits[0]`, its solution's digit, selecting it and then choosing the digit.
 * - `none`: nothing, at the last step.
 */
export type TutorialDemoKind = 'select' | 'note' | 'link' | 'fill' | 'none';

/** A walk through making notes, on a practice puzzle, a step at a time, with a demo of what to do at each. */
export interface TutorialModel {
    readonly step: TutorialStep;
    /** Which step it is, from 1. */
    readonly stepNumber: number;
    readonly demo: TutorialDemoKind;
    /** The demo's cells and digits. Each list is replaced, never changed, as the demo changes. */
    readonly demoCells: readonly number[];
    readonly demoDigits: readonly number[];
    /** A count that rises each time the demo changes, as the player moves on or does part of a step. */
    readonly demosShown: number;
    /** Moves on a step if the player has done what this one asks, and finds the demo for the puzzle as it is now. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface TutorialModelOptions {
    /** The practice puzzle the player follows the steps in. */
    readonly puzzle: PuzzleModel;
    /** Its one solution, for the digit the fill demo fills in. */
    readonly solution: readonly number[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the tutorial at its first step, with its first demo. */
export function createTutorialModel(options: TutorialModelOptions): TutorialModel {
    const { puzzle, solution } = options;
    let index = 0;
    let demo: TutorialDemoKind = 'none';
    let demoCells: readonly number[] = [];
    let demoDigits: readonly number[] = [];
    let demosShown = 0;
    // What the demo was found from, so it is only looked for again once one of them changes
    let foundIndex = -1;
    let foundChanges = -1;
    let foundSelection: readonly number[] | undefined;
    findDemo();

    return {
        get step() { return TUTORIAL_STEPS[index]; },
        get stepNumber() { return index + 1; },
        get demo() { return demo; },
        get demoCells() { return demoCells; },
        get demoDigits() { return demoDigits; },
        get demosShown() { return demosShown; },
        update(_deltaMs) {
            if (index < TUTORIAL_STEPS.length - 1 && isStepDone(TUTORIAL_STEPS[index])) index++;
            if (index !== foundIndex || puzzle.changes !== foundChanges || puzzle.selection !== foundSelection) findDemo();
        },
    };

    function isStepDone(step: TutorialStep): boolean {
        const { selection } = puzzle;
        switch (step) {
            case 'select': return selection.length === 1;
            case 'mark': return selection.length === 1 && countDigits(puzzle.marksAt(selection[0])) >= 2;
            case 'link': return selection.length >= 2 && puzzle.canNoteSelection;
            case 'group': return puzzle.groupNotes.some((note) => countDigits(note.digits) >= 2);
            case 'fill': return puzzle.answersPlaced > 0;
            case 'done': return false;
        }
    }

    // --- Demos ---

    function findDemo(): void {
        foundIndex = index;
        foundChanges = puzzle.changes;
        foundSelection = puzzle.selection;
        const { selection } = puzzle;
        switch (TUTORIAL_STEPS[index]) {
            case 'select':
                showSelectDemo();
                return;
            case 'mark':
                // Marks go in one cell selected. With none, or several, the demo goes back to selecting one
                if (selection.length === 1) showNoteDemo(puzzle.candidatesAt(selection[0]));
                else showSelectDemo();
                return;
            case 'link':
                showLinkDemo();
                return;
            case 'group':
                if (selection.length >= 2 && puzzle.canNoteSelection) showNoteDemo(findSharedCandidates(selection));
                else showLinkDemo();
                return;
            case 'fill':
                showFillDemo();
                return;
            case 'done':
                show('none', [], []);
                return;
        }
    }

    function showSelectDemo(): void {
        show('select', [findCellToSelect()], []);
    }

    /** Notes enough digits to make two, those that could go there first. */
    function showNoteDemo(candidates: number): void {
        const noted = puzzle.selectionDigits;
        const needed = Math.max(1, 2 - countDigits(noted));
        const digits: number[] = [];
        for (let digit = 1; digit <= 9 && digits.length < needed; digit++) {
            if (hasDigit(candidates, digit) && !hasDigit(noted, digit)) digits.push(digit);
        }
        for (let digit = 1; digit <= 9 && digits.length < needed; digit++) {
            if (!hasDigit(noted, digit) && !digits.includes(digit)) digits.push(digit);
        }
        show('note', [], digits);
    }

    function showLinkDemo(): void {
        show('link', findCellsToLink(), []);
    }

    function showFillDemo(): void {
        const cell = findCellToFill();
        show('fill', [cell], [solution[cell]]);
    }

    /** Changes the demo to this one, unless it is the one shown already. */
    function show(kind: TutorialDemoKind, cells: readonly number[], digits: readonly number[]): void {
        if (kind === demo && isSameList(cells, demoCells) && isSameList(digits, demoDigits)) return;
        demo = kind;
        demoCells = cells;
        demoDigits = digits;
        demosShown++;
    }

    /** An empty cell with room for two pencil marks, from the middle of the grid, so the demo is in plain sight. */
    function findCellToSelect(): number {
        for (let i = 0; i < CELL_COUNT; i++) {
            const cell = (FIRST_CELL_TRIED + i) % CELL_COUNT;
            if (countDigits(puzzle.candidatesAt(cell)) >= 2) return cell;
        }
        return findEmptyCell();
    }

    /**
     * Two empty cells in one row, column or box which share two digits that
     * could go in them, as close together as can be found, or failing that
     * the first two side by side.
     */
    function findCellsToLink(): readonly number[] {
        let best: readonly number[] = [];
        let bestDistance = Infinity;
        let fallback = -1;
        for (let i = 0; i < CELL_COUNT; i++) {
            const cell = (FIRST_CELL_TRIED + i) % CELL_COUNT;
            const candidates = puzzle.candidatesAt(cell);
            if (candidates === 0) continue;
            if (fallback < 0 && COLUMN_OF[cell] < 8 && puzzle.candidatesAt(cell + 1) !== 0) fallback = cell;
            for (let other = cell + 1; other < CELL_COUNT; other++) {
                const distance = Math.abs(ROW_OF[other] - ROW_OF[cell]) + Math.abs(COLUMN_OF[other] - COLUMN_OF[cell]);
                if (distance >= bestDistance || !isSameUnit(cell, other)) continue;
                if (countDigits(candidates & puzzle.candidatesAt(other)) < 2) continue;
                best = [cell, other];
                bestDistance = distance;
            }
        }
        if (best.length > 0 || fallback < 0) return best;
        return [fallback, fallback + 1];
    }

    /** The digits that could go in every one of `cells`, or failing two of those, in any of them. */
    function findSharedCandidates(cells: readonly number[]): number {
        let shared = ALL_DIGITS;
        let any = 0;
        for (let i = 0; i < cells.length; i++) {
            shared &= puzzle.candidatesAt(cells[i]);
            any |= puzzle.candidatesAt(cells[i]);
        }
        return countDigits(shared) >= 2 ? shared : any;
    }

    /** An empty cell that only one digit could go in, which is easy to see, or failing that the first empty cell. */
    function findCellToFill(): number {
        for (let i = 0; i < CELL_COUNT; i++) {
            const cell = (FIRST_CELL_TRIED + i) % CELL_COUNT;
            if (puzzle.candidatesAt(cell) === 1 << solution[cell]) return cell;
        }
        return findEmptyCell();
    }

    function findEmptyCell(): number {
        for (let cell = 0; cell < CELL_COUNT; cell++) if (puzzle.digitAt(cell) === 0) return cell;
        return 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The cell the demos look from first: the left end of the fourth row, the top row of the middle band of boxes, so the demo is in plain sight. */
const FIRST_CELL_TRIED = 27;

function isSameList(a: readonly number[], b: readonly number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}
