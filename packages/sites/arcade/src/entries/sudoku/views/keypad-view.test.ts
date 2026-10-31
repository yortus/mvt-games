import { describe, expect, it } from 'vitest';
import type { Container, FederatedPointerEvent } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { loadSudokuGenerator } from '#sudoku-digger';
import { createPuzzleModel } from '../models';
import { KeypadView } from './keypad-view';

// The keypad is wired to a real puzzle, as the puzzle's screen wires it, and its keys are tapped.

const generateSudoku = await loadSudokuGenerator();
const { givens, solution } = generateSudoku({ seed: 1, level: 'easy' });
/** Two empty cells side by side. */
const CELL = givens.findIndex((digit, cell) => digit === 0 && cell % 9 < 8 && givens[cell + 1] === 0);

describe('KeypadView', () => {
    it('fills the one cell selected on a double tap of a key, leaving no mark from the first tap', () => {
        const { puzzle, tapKey, tick } = setUp();
        puzzle.select([CELL]);
        tapKey(solution[CELL]);
        tick(100);
        tapKey(solution[CELL]);
        expect(puzzle.digitAt(CELL)).toBe(solution[CELL]);
        expect(puzzle.marksAt(CELL)).toBe(0);
        // The fill is the only action left to undo
        expect(puzzle.undoCount).toBe(1);
    });

    it('pencils a mark in and out with two taps too far apart to be a double tap', () => {
        const { puzzle, tapKey, tick } = setUp();
        puzzle.select([CELL]);
        tapKey(4);
        expect(puzzle.marksAt(CELL)).toBe(1 << 4);
        tick(500);
        tapKey(4);
        expect(puzzle.marksAt(CELL)).toBe(0);
        expect(puzzle.digitAt(CELL)).toBe(0);
    });

    it('fills nothing on a double tap while several cells are selected, but notes the digit for them and takes it out again', () => {
        const { puzzle, tapKey, tick } = setUp();
        puzzle.select([CELL, CELL + 1]);
        tapKey(4);
        tick(100);
        tapKey(4);
        expect(puzzle.digitAt(CELL)).toBe(0);
        expect(puzzle.groupNotes).toEqual([]);
    });
});

function setUp() {
    const puzzle = createPuzzleModel({ givens, solution });
    const keypad = KeypadView({
        digits: () => puzzle.selectionDigits,
        isEnabled: () => puzzle.canNoteSelection,
        canFill: () => puzzle.selection.length === 1,
        changes: () => puzzle.changes,
        onPressed: puzzle.toggleNote,
        onDoubleTapped: (digit) => puzzle.fillCell(puzzle.selection[0], digit),
        onTapTakenBack: puzzle.undo,
    });
    const tick = (deltaMs = 16): void => {
        updateView(keypad, deltaMs);
        refreshView(keypad);
    };
    const tapKey = (digit: number): void => {
        const key = keypad.children[digit - 1] as Container;
        key.emit('pointertap', {} as FederatedPointerEvent);
    };
    tick();
    return { puzzle, tapKey, tick };
}
