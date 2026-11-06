import { describe, expect, it } from 'vitest';
import type { Container, FederatedPointerEvent } from 'pixi.js';
import { advanceTime, refreshView } from '@mvtjs/pixi';
import { loadSudokuGenerator } from '../generator';
import { createPuzzleModel } from '../models';
import { KeypadView } from './keypad-view';
import { KEY_HOLD_MS } from './view-constants';

// The keypad is wired to a real puzzle, as the puzzle's screen wires it, and its keys are pressed, then let go or held.

const generateSudoku = await loadSudokuGenerator();
const { givens, solution } = generateSudoku({ seed: 1, level: 'easy' });
/** Two empty cells side by side. */
const CELL = givens.findIndex((digit, cell) => digit === 0 && cell % 9 < 8 && givens[cell + 1] === 0);

describe('KeypadView', () => {
    it('pencils a mark in and out with a tap', async () => {
        const { puzzle, tapKey } = setUp();
        puzzle.select([CELL]);
        await tapKey(4);
        expect(puzzle.marksAt(CELL)).toBe(1 << 4);
        await tapKey(4);
        expect(puzzle.marksAt(CELL)).toBe(0);
        expect(puzzle.digitAt(CELL)).toBe(0);
    });

    it('fills the one cell selected as a key is held, leaving no mark, and does nothing more as it is let go', async () => {
        const { puzzle, holdKey } = setUp();
        puzzle.select([CELL]);
        await holdKey(solution[CELL]);
        expect(puzzle.digitAt(CELL)).toBe(solution[CELL]);
        expect(puzzle.marksAt(CELL)).toBe(0);
        expect(puzzle.undoCount).toBe(1);
    });

    it('takes a press let go before it is held long enough for a tap', async () => {
        const { puzzle, keyOf, tick } = setUp();
        puzzle.select([CELL]);
        keyOf(4).emit('pointerdown', {} as FederatedPointerEvent);
        await tick(KEY_HOLD_MS / 2);
        keyOf(4).emit('pointerup', {} as FederatedPointerEvent);
        expect(puzzle.digitAt(CELL)).toBe(0);
        expect(puzzle.marksAt(CELL)).toBe(1 << 4);
    });

    it('fills nothing as a key is held while several cells are selected, but notes the digit for them as it is let go', async () => {
        const { puzzle, holdKey } = setUp();
        puzzle.select([CELL, CELL + 1]);
        await holdKey(4);
        expect(puzzle.digitAt(CELL)).toBe(0);
        expect(puzzle.groupNotes.length).toBe(1);
    });

    it('drops a press that slides off its key', async () => {
        const { puzzle, keyOf, tick } = setUp();
        puzzle.select([CELL]);
        keyOf(4).emit('pointerdown', {} as FederatedPointerEvent);
        keyOf(4).emit('pointerupoutside', {} as FederatedPointerEvent);
        await tick(KEY_HOLD_MS * 2);
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
    const tick = async (ms: number): Promise<void> => {
        await advanceTime(ms, keypad);
        refreshView(keypad);
    };
    const keyOf = (digit: number): Container => keypad.children[digit - 1] as Container;
    const tapKey = async (digit: number): Promise<void> => {
        keyOf(digit).emit('pointerdown', {} as FederatedPointerEvent);
        await tick(KEY_HOLD_MS / 2);
        keyOf(digit).emit('pointerup', {} as FederatedPointerEvent);
    };
    const holdKey = async (digit: number): Promise<void> => {
        keyOf(digit).emit('pointerdown', {} as FederatedPointerEvent);
        await tick(KEY_HOLD_MS * 2);
        keyOf(digit).emit('pointerup', {} as FederatedPointerEvent);
    };
    refreshView(keypad);
    return { puzzle, keyOf, tick, tapKey, holdKey };
}
