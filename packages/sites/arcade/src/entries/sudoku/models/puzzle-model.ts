import { CELL_COUNT, findCandidates, hasDigit, isOneUnit, toDigitSet } from '#sudoku-digger';
import { findGroupNote, type GroupNote, shrinkGroupNotes, toggleGroupNote } from './group-notes';
import { MOST_UNDOS } from './model-constants';
import { type PuzzleSave, readPuzzleSave, writePuzzleSave } from './puzzle-save';
import { createUndoHistory } from './undo-history';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * One puzzle being played: its givens, the player's answers, and their
 * notes. A note is a pencil mark, a digit that might go in a cell, or a
 * group note, digits that a few cells in one row, column or box hold
 * between them, in some order. Every action that changes the grid can be
 * undone, back to the start of the visit. Once the puzzle is solved, it
 * takes no more actions.
 *
 * The model keeps the cells and the selection. It is built on three parts
 * of its own: the rules of group notes, as functions of a list of notes;
 * an undo history, which keeps each action's cells and notes as they were
 * before it; and the puzzle's save, which it writes, and checks as it reads
 * one back.
 */
export interface PuzzleModel {
    /** The digit in `cell`: its given, the player's answer, or 0 if it is empty. */
    readonly digitAt: (cell: number) => number;
    readonly isGivenAt: (cell: number) => boolean;
    /** Whether the digit in `cell` is also in its row, its column or its box, which the rules forbid. */
    readonly isClashAt: (cell: number) => boolean;
    /** The digits that could go in `cell`, as a set: those that no digit in its row, its column or its box rules out. None for a filled cell. */
    readonly candidatesAt: (cell: number) => number;
    /** The digits pencilled into `cell`, as a set: bit `d` is set for each digit `d`. */
    readonly marksAt: (cell: number) => number;
    /** The group notes, oldest first. None holds a filled cell. The list is replaced, never changed, so a view can tell when it changes. */
    readonly groupNotes: readonly GroupNote[];
    /** The cells selected for notes, in order: none, one, or several. Only empty cells can be selected. */
    readonly selection: readonly number[];
    readonly isSelectedAt: (cell: number) => boolean;
    /**
     * Whether notes can be made for the selection: it is one cell, or
     * several that share a row, a column or a box, and the puzzle is not
     * solved.
     */
    readonly canNoteSelection: boolean;
    /** The digits noted for the selection, as a set: the one cell's pencil marks, or the group note of exactly those cells. */
    readonly selectionDigits: number;
    /** The cell whose number is being chosen, or -1. */
    readonly pickerCell: number;
    /** Whether every cell holds its solution's digit. */
    readonly isSolved: boolean;
    /** How many actions undo can take back. */
    readonly undoCount: number;
    /** A count that rises with every action finished and every undo, so that progress can be kept as it changes. */
    readonly changes: number;
    /** Answers filled in, answers that broke a rule as they went in, and actions undone, since the puzzle started. */
    readonly answersPlaced: number;
    readonly clashesMade: number;
    readonly undosDone: number;
    /** The cell filled in or emptied last, or -1. */
    readonly lastFilledCell: number;

    /** Selects `cells` for notes, leaving out any that are not empty. */
    select: (cells: readonly number[]) => void;
    /**
     * Notes `digit` for the selection, or takes it out if it is there: a
     * pencil mark for one cell, or a digit of the group note for several. A
     * group note with no digits left is gone.
     */
    toggleNote: (digit: number) => void;
    /** Opens the choice of a number for `cell`, unless it is given. */
    openPicker: (cell: number) => void;
    closePicker: () => void;
    /**
     * Fills `digit` into the picker's cell, or empties it for 0, and closes
     * the picker. Either way, the cell's marks go. A filled cell belongs to
     * no group note, so each note that holds it shrinks to leave it out, and
     * gives up the digit too, if it holds it. Left with no digits, a note is
     * gone, and left with one cell, its digits become pencil marks there.
     */
    fillIn: (digit: number) => void;
    /** Fills `digit` into `cell`, as `fillIn` does, without the picker. For filling the one cell selected. */
    fillCell: (cell: number, digit: number) => void;
    /** Takes back the last action. */
    undo: () => void;
    /** Returns the puzzle as it stands, to be restored later through the options' `saved`. */
    save: () => PuzzleSave;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PuzzleModelOptions {
    /** The puzzle's 81 cells, row by row: the digit given in each, or 0 for a cell to fill in. */
    readonly givens: readonly number[];
    /** Its one solution. */
    readonly solution: readonly number[];
    /**
     * A save of this puzzle, from `save`, maybe from a visit before. It is
     * read from storage, so it is checked first. One that is not a save of
     * these givens is ignored, and the puzzle starts afresh.
     */
    readonly saved?: unknown;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a puzzle with nothing filled in or noted, or as it was saved. */
export function createPuzzleModel(options: PuzzleModelOptions): PuzzleModel {
    const { givens, solution } = options;
    // Every cell's digit, given or the player's answer, or 0, and its pencil marks
    const digits = Uint8Array.from(givens);
    const marks = new Uint16Array(CELL_COUNT);
    const history = createUndoHistory({ digits, marks, mostUndos: MOST_UNDOS });
    let groupNotes: readonly GroupNote[] = [];
    let nextGroupId = 1;
    let selection: readonly number[] = [];
    // What the selection allows, worked out as it changes, and as the group
    // notes do, since views ask about it every frame: whether its cells share
    // a row, a column or a box, and the group note of exactly its cells
    let isSelectionOneUnit = false;
    let selectionNote: GroupNote | undefined;
    const clashes = new Uint8Array(CELL_COUNT);

    let pickerCell = -1;
    let isSolved = false;
    let changes = 0;
    let answersPlaced = 0;
    let clashesMade = 0;
    let undosDone = 0;
    let lastFilledCell = -1;

    restore(readPuzzleSave(options.saved, givens));
    findClashes();
    isSolved = checkSolved();

    const model: PuzzleModel = {
        digitAt: (cell) => digits[cell],
        isGivenAt: (cell) => givens[cell] !== 0,
        isClashAt: (cell) => clashes[cell] === 1,
        candidatesAt: (cell) => (digits[cell] === 0 ? findCandidates(digits, cell) : 0),
        marksAt: (cell) => marks[cell],
        get groupNotes() { return groupNotes; },
        get selection() { return selection; },
        isSelectedAt: (cell) => selection.includes(cell),
        get canNoteSelection() { return canNoteSelection(); },
        get selectionDigits() { return selection.length === 1 ? marks[selection[0]] : selectionNote?.digits ?? 0; },
        get pickerCell() { return pickerCell; },
        get isSolved() { return isSolved; },
        get undoCount() { return history.count; },
        get changes() { return changes; },
        get answersPlaced() { return answersPlaced; },
        get clashesMade() { return clashesMade; },
        get undosDone() { return undosDone; },
        get lastFilledCell() { return lastFilledCell; },
        select(cells) {
            if (pickerCell >= 0) return;
            const empty = cells.filter((cell, i) => digits[cell] === 0 && cells.indexOf(cell) === i);
            selectCells(empty.sort((a, b) => a - b));
        },
        toggleNote,
        openPicker(cell) {
            if (isSolved || isBusy() || givens[cell] !== 0) return;
            pickerCell = cell;
        },
        closePicker() { pickerCell = -1; },
        fillIn,
        fillCell(cell, digit) {
            if (isSolved || isBusy() || givens[cell] !== 0) return;
            fill(cell, digit);
        },
        undo,
        save: () => writePuzzleSave({ givens, digits, marks, groupNotes }),
    };
    return model;

    // --- Marks and group notes ---

    function canNoteSelection(): boolean {
        return !isSolved && isSelectionOneUnit;
    }

    function selectCells(cells: readonly number[]): void {
        selection = cells;
        isSelectionOneUnit = cells.length === 1 || (cells.length > 1 && isOneUnit(cells));
        selectionNote = findGroupNote(groupNotes, cells);
    }

    function replaceGroupNotes(notes: readonly GroupNote[]): void {
        groupNotes = notes;
        selectionNote = findGroupNote(notes, selection);
    }

    function toggleNote(digit: number): void {
        if (isBusy() || !canNoteSelection()) return;
        history.start();
        if (selection.length === 1) {
            history.keepCell(selection[0]);
            marks[selection[0]] ^= toDigitSet(digit);
        }
        else {
            history.keepGroupNotes(groupNotes);
            const isNew = selectionNote === undefined;
            replaceGroupNotes(toggleGroupNote(groupNotes, selection, digit, nextGroupId));
            if (isNew) nextGroupId++;
        }
        finishAction();
    }

    // --- Answers ---

    function fillIn(digit: number): void {
        const cell = pickerCell;
        if (cell < 0) return;
        pickerCell = -1;
        fill(cell, digit);
    }

    /**
     * Fills `digit` into `cell`, or empties it for 0. Its marks go. A filled
     * cell belongs to no group note, so each note that holds it shrinks, and
     * a note left with one cell becomes pencil marks there.
     */
    function fill(cell: number, digit: number): void {
        if (digits[cell] === digit && marks[cell] === 0) return;
        history.start();
        history.keepCell(cell);
        digits[cell] = digit;
        lastFilledCell = cell;
        marks[cell] = 0;
        if (digit !== 0) {
            selectCells(selection.filter((each) => each !== cell));
            const shrunk = shrinkGroupNotes(groupNotes, cell, digit, pencilInLeftOver);
            if (shrunk !== groupNotes) {
                history.keepGroupNotes(groupNotes);
                replaceGroupNotes(shrunk);
            }
        }
        finishAction();
        findClashes();
        if (digit !== 0) answersPlaced++;
        if (digit !== 0 && clashes[cell] === 1) clashesMade++;
        isSolved = checkSolved();
    }

    /** Pencils into `cell` the digits of a group note left with only that cell, if it is still empty. */
    function pencilInLeftOver(cell: number, noteDigits: number): void {
        if (digits[cell] !== 0) return;
        history.keepCell(cell);
        marks[cell] |= noteDigits;
    }

    function undo(): void {
        if (isSolved || isBusy()) return;
        const notesBefore = history.undo(groupNotes);
        if (notesBefore === undefined) return;
        replaceGroupNotes(notesBefore);
        // A cell filled in again can't stay selected
        selectCells(selection.filter((cell) => digits[cell] === 0));
        findClashes();
        isSolved = checkSolved();
        undosDone++;
        changes++;
    }

    function finishAction(): void {
        if (history.finish()) changes++;
    }

    /** Whether the picker is open, which leaves no room for another action. */
    function isBusy(): boolean {
        return pickerCell >= 0;
    }

    // --- The rules ---

    /** Marks each cell whose digit is also in its row, its column or its box, as one that couldn't go there. */
    function findClashes(): void {
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            const digit = digits[cell];
            clashes[cell] = digit !== 0 && !hasDigit(findCandidates(digits, cell), digit) ? 1 : 0;
        }
    }

    function checkSolved(): boolean {
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            if (digits[cell] !== solution[cell]) return false;
        }
        return true;
    }

    /** Takes up the answers and notes of `saved`, a save of this puzzle, if there is one. */
    function restore(saved: PuzzleSave | undefined): void {
        if (saved === undefined) return;
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            digits[cell] = givens[cell] || Number(saved.answers[cell]);
            marks[cell] = givens[cell] === 0 ? saved.marks[cell] : 0;
        }
        replaceGroupNotes(saved.groupNotes.map((note) => ({ id: nextGroupId++, cells: note.cells, digits: note.digits })));
    }
}
