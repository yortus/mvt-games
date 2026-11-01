import type { Demo, DemoTouch, IntroModelOptions } from '../../../shared';
import { ALL_DIGITS, CELL_COUNT, COLUMN_OF, countDigits, hasDigit, isSameUnit, ROW_OF } from '../generator';
import type { PuzzleModel } from './puzzle-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The puzzle a walkthrough plays on, and its one solution, for the digit the fill step's demo fills in. */
export interface SudokuPractice {
    readonly puzzle: PuzzleModel;
    readonly solution: readonly number[];
}

/** What the walkthrough's arrow touches: a cell of the grid, or a digit's key on the keypad. */
export type SudokuTarget = { readonly on: 'cell'; readonly cell: number } | { readonly on: 'key'; readonly digit: number };

/** The walkthrough of making notes: its steps, what their demos are found from, and how to tell targets apart. */
export type SudokuWalkthrough = Pick<IntroModelOptions<SudokuPractice, SudokuTarget>, 'steps' | 'findWhenChanged' | 'isSameTarget'>;

/**
 * How to make notes, a step at a time. Each step asks the player to do one
 * thing, and is done once they have:
 *
 * - `select`: select a cell.
 * - `mark`: pencil two digits into a cell.
 * - `link`: select two or more cells in one row, column or box.
 * - `group`: note two or more digits for them, as a group note.
 * - `fill`: fill a cell in.
 * - `done`: nothing more to do.
 *
 * The demos are found on the practice puzzle as it stands, in plain sight
 * near the middle of the grid: a cell with room for two marks, the closest
 * two cells in a unit sharing two candidates, and a cell only one digit can
 * go in.
 */
export const SUDOKU_WALKTHROUGH: SudokuWalkthrough = {
    steps: [
        {
            name: 'select',
            text: 'Tap an empty cell to select it. This is a practice puzzle, so try anything you like.',
            isDone: ({ puzzle }) => puzzle.selection.length === 1,
            findDemo: findSelectDemo,
        },
        {
            name: 'mark',
            text: 'Tap two digits that could go in the cell, to pencil them in. Tap one again to take it out.',
            isDone: ({ puzzle }) => puzzle.selection.length === 1 && countDigits(puzzle.marksAt(puzzle.selection[0])) >= 2,
            // Marks go in one cell selected. With none, or several, the demo goes back to selecting one
            findDemo: (practice) => {
                const { selection } = practice.puzzle;
                return selection.length === 1 ? findNoteDemo(practice, practice.puzzle.candidatesAt(selection[0])) : findSelectDemo(practice);
            },
        },
        {
            name: 'link',
            text: 'Drag across two empty cells in a row, a column or a box, to link them.',
            isDone: ({ puzzle }) => puzzle.selection.length >= 2 && puzzle.canNoteSelection,
            findDemo: findLinkDemo,
        },
        {
            name: 'group',
            text: 'Tap the digits that go in the linked cells, in either order, to note them across both.',
            isDone: ({ puzzle }) => puzzle.groupNotes.some((note) => countDigits(note.digits) >= 2),
            findDemo: (practice) => {
                const { selection, canNoteSelection } = practice.puzzle;
                return selection.length >= 2 && canNoteSelection ? findNoteDemo(practice, findSharedCandidates(practice, selection)) : findLinkDemo(practice);
            },
        },
        {
            name: 'fill',
            text: writeFillText,
            isDone: ({ puzzle }) => puzzle.answersPlaced > 0,
            findDemo: (practice) => {
                const cell = findCellToFill(practice);
                return [tapOn({ on: 'cell', cell }), { kind: 'hold', targets: [{ on: 'key', digit: practice.solution[cell] }] }];
            },
        },
        {
            name: 'done',
            text: 'Fill in cells when you know them: their notes clear away. Undo takes back anything. Have fun!',
            isDone: () => false,
            findDemo: () => NO_DEMO,
        },
    ],
    findWhenChanged: [({ puzzle }) => puzzle.changes, ({ puzzle }) => puzzle.selection],
    isSameTarget: (a, b) => (a.on === 'cell' ? b.on === 'cell' && a.cell === b.cell : b.on === 'key' && a.digit === b.digit),
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The cell the demos look from first: the left end of the fourth row, the top row of the middle band of boxes, so the demo is in plain sight. */
const FIRST_CELL_TRIED = 27;

const NO_DEMO: Demo<SudokuTarget> = [];

function tapOn(target: SudokuTarget): DemoTouch<SudokuTarget> {
    return { kind: 'tap', targets: [target] };
}

/** The fill step's text, which names the digit its demo fills in. */
function writeFillText(demo: Demo<SudokuTarget>): string {
    const target = demo[1]?.targets[0];
    const digit = target?.on === 'key' ? target.digit : 0;
    return `Tap a cell, then press and hold its digit to fill it in. Only a ${digit} can go in this one.`;
}

function findSelectDemo(practice: SudokuPractice): Demo<SudokuTarget> {
    return [tapOn({ on: 'cell', cell: findCellToSelect(practice) })];
}

function findLinkDemo(practice: SudokuPractice): Demo<SudokuTarget> {
    const cells = findCellsToLink(practice);
    if (cells.length < 2) return NO_DEMO;
    return [{ kind: 'drag', targets: [{ on: 'cell', cell: cells[0] }, { on: 'cell', cell: cells[1] }] }];
}

/** Taps enough digits' keys to note two, those that could go there first. */
function findNoteDemo({ puzzle }: SudokuPractice, candidates: number): Demo<SudokuTarget> {
    const noted = puzzle.selectionDigits;
    const needed = Math.max(1, 2 - countDigits(noted));
    const digits: number[] = [];
    for (let digit = 1; digit <= 9 && digits.length < needed; digit++) {
        if (hasDigit(candidates, digit) && !hasDigit(noted, digit)) digits.push(digit);
    }
    for (let digit = 1; digit <= 9 && digits.length < needed; digit++) {
        if (!hasDigit(noted, digit) && !digits.includes(digit)) digits.push(digit);
    }
    return digits.map((digit) => tapOn({ on: 'key', digit }));
}

/** An empty cell with room for two pencil marks, from the middle of the grid, so the demo is in plain sight. */
function findCellToSelect(practice: SudokuPractice): number {
    for (let i = 0; i < CELL_COUNT; i++) {
        const cell = (FIRST_CELL_TRIED + i) % CELL_COUNT;
        if (countDigits(practice.puzzle.candidatesAt(cell)) >= 2) return cell;
    }
    return findEmptyCell(practice);
}

/**
 * Two empty cells in one row, column or box which share two digits that
 * could go in them, as close together as can be found, or failing that
 * the first two side by side.
 */
function findCellsToLink({ puzzle }: SudokuPractice): readonly number[] {
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
function findSharedCandidates({ puzzle }: SudokuPractice, cells: readonly number[]): number {
    let shared = ALL_DIGITS;
    let any = 0;
    for (let i = 0; i < cells.length; i++) {
        shared &= puzzle.candidatesAt(cells[i]);
        any |= puzzle.candidatesAt(cells[i]);
    }
    return countDigits(shared) >= 2 ? shared : any;
}

/** An empty cell that only one digit could go in, which is easy to see, or failing that the first empty cell. */
function findCellToFill(practice: SudokuPractice): number {
    for (let i = 0; i < CELL_COUNT; i++) {
        const cell = (FIRST_CELL_TRIED + i) % CELL_COUNT;
        if (practice.puzzle.candidatesAt(cell) === 1 << practice.solution[cell]) return cell;
    }
    return findEmptyCell(practice);
}

function findEmptyCell({ puzzle }: SudokuPractice): number {
    for (let cell = 0; cell < CELL_COUNT; cell++) if (puzzle.digitAt(cell) === 0) return cell;
    return 0;
}
