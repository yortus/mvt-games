import { describe, expect, it } from 'vitest';
import type { Container, FederatedPointerEvent } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { loadSudokuGenerator } from '../generator';
import { createPuzzleModel } from '../models';
import { KeypadView } from './keypad-view';

// The keypad is wired to a real puzzle, as the puzzle's screen wires it, and its keys are pressed, then let go or held.

const generateSudoku = await loadSudokuGenerator();
const { givens, solution } = generateSudoku({ seed: 1, level: 'easy' });
/** Two empty cells side by side. */
const CELL = givens.findIndex((digit, cell) => digit === 0 && cell % 9 < 8 && givens[cell + 1] === 0);

describe('KeypadView', () => {
    it('pencils a mark in and out with a tap', () => {
        const { puzzle, tapKey } = setUp();
        puzzle.select([CELL]);
        tapKey(4);
        expect(puzzle.marksAt(CELL)).toBe(1 << 4);
        tapKey(4);
        expect(puzzle.marksAt(CELL)).toBe(0);
        expect(puzzle.digitAt(CELL)).toBe(0);
    });

    it('fills the one cell selected as a key is held, leaving no mark, and does nothing more as it is let go', () => {
        const { puzzle, holdKey } = setUp();
        puzzle.select([CELL]);
        holdKey(solution[CELL]);
        expect(puzzle.digitAt(CELL)).toBe(solution[CELL]);
        expect(puzzle.marksAt(CELL)).toBe(0);
        expect(puzzle.undoCount).toBe(1);
    });

    it('takes a press let go before it is held long enough for a tap', () => {
        const { puzzle, keyOf, tick } = setUp();
        puzzle.select([CELL]);
        keyOf(4).emit('pointerdown', {} as FederatedPointerEvent);
        tick(200);
        keyOf(4).emit('pointerup', {} as FederatedPointerEvent);
        expect(puzzle.digitAt(CELL)).toBe(0);
        expect(puzzle.marksAt(CELL)).toBe(1 << 4);
    });

    it('fills nothing as a key is held while several cells are selected, but notes the digit for them as it is let go', () => {
        const { puzzle, holdKey } = setUp();
        puzzle.select([CELL, CELL + 1]);
        holdKey(4);
        expect(puzzle.digitAt(CELL)).toBe(0);
        expect(puzzle.groupNotes.length).toBe(1);
    });

    it('drops a press that slides off its key', () => {
        const { puzzle, keyOf, tick } = setUp();
        puzzle.select([CELL]);
        keyOf(4).emit('pointerdown', {} as FederatedPointerEvent);
        keyOf(4).emit('pointerupoutside', {} as FederatedPointerEvent);
        tick(600);
        expect(puzzle.digitAt(CELL)).toBe(0);
        expect(puzzle.marksAt(CELL)).toBe(0);
    });
});

function setUp() {
    const puzzle = createPuzzleModel({ givens, solution });
    const keypad = KeypadView({
        digits: () => puzzle.selectionDigits,
        isEnabled: () => puzzle.canNoteSelection || puzzle.selection.length === 1,
        canFill: () => puzzle.selection.length === 1,
        onTapped: puzzle.toggleNote,
        onHeld: (digit) => puzzle.fillCell(puzzle.selection[0], digit),
    });
    const tick = (ms = 16): void => {
        for (let left = ms; left > 0; left -= 16) updateView(keypad, Math.min(16, left));
        refreshView(keypad);
    };
    const keyOf = (digit: number): Container => keypad.children[digit - 1] as Container;
    const tapKey = (digit: number): void => {
        keyOf(digit).emit('pointerdown', {} as FederatedPointerEvent);
        tick(50);
        keyOf(digit).emit('pointerup', {} as FederatedPointerEvent);
    };
    const holdKey = (digit: number): void => {
        keyOf(digit).emit('pointerdown', {} as FederatedPointerEvent);
        tick(600);
        keyOf(digit).emit('pointerup', {} as FederatedPointerEvent);
    };
    tick();
    return { puzzle, keyOf, tick, tapKey, holdKey };
}
