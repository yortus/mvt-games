import { describe, expect, it } from 'vitest';
import type { Container, FederatedPointerEvent } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { loadSudokuGenerator } from '#sudoku-digger';
import { createPuzzleModel } from '../models';
import { BoardView } from './board-view';
import { CELL_SIZE } from './view-constants';

// The board is wired to a real puzzle, as the puzzle's screen wires it, and played with pointer events. Positions
// are in the board's pixels.

const generateSudoku = await loadSudokuGenerator();
const { givens, solution } = generateSudoku({ seed: 1, level: 'easy' });
const GIVEN_CELL = givens.findIndex((digit) => digit !== 0);
/** Two empty cells side by side, and two corner to corner. */
const PAIR = givens.findIndex((digit, cell) => digit === 0 && cell % 9 < 8 && givens[cell + 1] === 0);
const DIAGONAL = givens.findIndex((digit, cell) => digit === 0 && cell % 9 < 8 && cell < 72 && givens[cell + 10] === 0);

describe('BoardView', () => {
    it('selects a cell with a tap, and clears it with another tap, later', () => {
        const { puzzle, board, tick } = setUp();
        const { x, y } = middleOf(PAIR);
        tap(board, x, y);
        expect(puzzle.selection).toEqual([PAIR]);
        tick(500);
        tap(board, x, y);
        expect(puzzle.selection).toEqual([]);
    });

    it('selects the cells a drag passes through, and takes one out with a tap', () => {
        const { puzzle, board, tick } = setUp();
        drag(board, middleOf(PAIR), middleOf(PAIR + 1));
        expect(puzzle.selection).toEqual([PAIR, PAIR + 1]);
        tick(500);
        tap(board, middleOf(PAIR + 1).x, middleOf(PAIR + 1).y);
        expect(puzzle.selection).toEqual([PAIR]);
    });

    it('takes in no cell whose corner a drag cuts across', () => {
        const { puzzle, board } = setUp();
        drag(board, middleOf(DIAGONAL), middleOf(DIAGONAL + 10));
        expect(puzzle.selection).toEqual([DIAGONAL, DIAGONAL + 10]);
    });

    it('selects the cells of a group note with a tap on its label', () => {
        const { puzzle, board, tick } = setUp();
        puzzle.select([PAIR, PAIR + 1]);
        puzzle.toggleNote(2);
        puzzle.toggleNote(8);
        puzzle.select([]);
        tick();
        // Two cells side by side have their label on the edge between them
        const { x, y } = middleOf(PAIR);
        tap(board, x + CELL_SIZE / 2, y);
        expect(puzzle.selection).toEqual([PAIR, PAIR + 1]);
    });

    it('opens the picker on a double tap', () => {
        const { puzzle, board, tick } = setUp();
        const { x, y } = middleOf(PAIR);
        tap(board, x, y);
        tick();
        tap(board, x, y);
        expect(puzzle.pickerCell).toBe(PAIR);
    });

    it('opens no picker on a double tap on a given, which is never selected either', () => {
        const { puzzle, board, tick } = setUp();
        const { x, y } = middleOf(GIVEN_CELL);
        tap(board, x, y);
        tick();
        tap(board, x, y);
        expect(puzzle.pickerCell).toBe(-1);
        expect(puzzle.selection).toEqual([]);
    });
});

function setUp() {
    const puzzle = createPuzzleModel({ givens, solution });
    const board = BoardView({
        digitAt: puzzle.digitAt,
        isGivenAt: puzzle.isGivenAt,
        isClashAt: puzzle.isClashAt,
        marksAt: puzzle.marksAt,
        groupNotes: () => puzzle.groupNotes,
        selection: () => puzzle.selection,
        onSelected: puzzle.select,
        puzzlesOpened: () => 1,
        pickerCell: () => puzzle.pickerCell,
        isSolved: () => puzzle.isSolved,
        changes: () => puzzle.changes,
        onCellDoubleTapped: puzzle.openPicker,
    });
    const tick = (deltaMs = 16): void => {
        updateView(board, deltaMs);
        refreshView(board);
    };
    tick();
    return { puzzle, board, tick };
}

function middleOf(cell: number): { x: number; y: number } {
    return { x: ((cell % 9) + 0.5) * CELL_SIZE, y: (Math.floor(cell / 9) + 0.5) * CELL_SIZE };
}

/** Drags the mouse from `from` to `to` in small steps, as a hand does. */
function drag(board: Container, from: { x: number; y: number }, to: { x: number; y: number }): void {
    board.emit('pointerdown', mouse(from.x, from.y));
    for (let i = 1; i <= 20; i++) board.emit('globalpointermove', mouse(from.x + ((to.x - from.x) * i) / 20, from.y + ((to.y - from.y) * i) / 20));
    board.emit('pointerup', mouse(to.x, to.y));
}

function tap(board: Container, x: number, y: number): void {
    board.emit('pointerdown', mouse(x, y));
    board.emit('pointerup', mouse(x, y));
}

/** A mouse event at (`x`, `y`), in the board's pixels. */
function mouse(x: number, y: number): FederatedPointerEvent {
    return { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, getLocalPosition: () => ({ x, y }) } as unknown as FederatedPointerEvent;
}
