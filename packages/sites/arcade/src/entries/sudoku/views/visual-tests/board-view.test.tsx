import { Container, Graphics } from 'pixi.js';
import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { loadSudokuGenerator } from '#sudoku-digger';
import { createPuzzleModel, type PuzzleModel } from '../../models';
import { BoardView } from '../board-view';
import { GRID_SIZE, PAPER_COLOR } from '../view-constants';

// The board is wired to a real puzzle, which is played in through the model.

const SIZE = { width: GRID_SIZE + 20, height: GRID_SIZE + 20, pixelArt: false };
const generateSudoku = await loadSudokuGenerator();
const { givens, solution } = generateSudoku({ seed: 4, level: 'medium' });
const EMPTY_CELLS = givens.flatMap((digit, cell) => (digit === 0 ? [cell] : []));

canvasTest('a fresh puzzle', SIZE, () => pose(() => undefined));

canvasTest('pencil marks, and group notes of cells that touch, cells apart, and a corner of a box', SIZE, () => pose((puzzle) => {
    const [first] = EMPTY_CELLS;
    puzzle.select([first]);
    for (const digit of [1, 5, 9]) puzzle.toggleNote(digit);
    const touching = EMPTY_CELLS.find((cell) => cell % 9 < 8 && cell > 18 && EMPTY_CELLS.includes(cell + 1)) ?? -1;
    note(puzzle, [touching, touching + 1], [2, 8]);
    const apart = EMPTY_CELLS.find((cell) => cell > 36 && cell % 9 < 5 && EMPTY_CELLS.includes(cell + 4)) ?? -1;
    note(puzzle, [apart, apart + 4], [3, 7]);
    const corner = EMPTY_CELLS.find((cell) => cell > 54 && cell % 3 < 2 && Math.floor(cell / 9) % 3 < 2
        && EMPTY_CELLS.includes(cell + 1) && EMPTY_CELLS.includes(cell + 10)) ?? -1;
    note(puzzle, [corner, corner + 1, corner + 10], [4, 6, 9]);
}));

canvasTest('three group notes sharing a cell, each in a lane of its own', SIZE, () => pose((puzzle) => {
    // A cell with empty cells beside it, two to its right and one below
    const shared = EMPTY_CELLS.find((cell) => cell % 9 < 6 && cell < 72
        && EMPTY_CELLS.includes(cell + 1) && EMPTY_CELLS.includes(cell + 3) && EMPTY_CELLS.includes(cell + 9)) ?? -1;
    note(puzzle, [shared, shared + 1], [2, 8]);
    note(puzzle, [shared, shared + 3], [2, 5]);
    note(puzzle, [shared, shared + 9], [1, 2]);
}));

canvasTest('a group note across filled cells, clear of their digits', SIZE, () => pose((puzzle) => {
    // Two empty cells in a row with only filled cells between them
    const first = EMPTY_CELLS.find((cell) => {
        const other = EMPTY_CELLS.find((each) => each > cell + 1 && Math.floor(each / 9) === Math.floor(cell / 9));
        return other !== undefined && EMPTY_CELLS.every((each) => each <= cell || each >= other || Math.floor(each / 9) !== Math.floor(cell / 9));
    }) ?? -1;
    const second = EMPTY_CELLS.find((each) => each > first + 1 && Math.floor(each / 9) === Math.floor(first / 9)) ?? -1;
    note(puzzle, [first, second], [3, 6]);
}));

canvasTest('a pair note turned into a pencil mark, as one of its digits is filled in', SIZE, () => pose((puzzle) => {
    const touching = EMPTY_CELLS.find((cell) => cell % 9 < 8 && EMPTY_CELLS.includes(cell + 1)) ?? -1;
    note(puzzle, [touching, touching + 1], [solution[touching], solution[touching + 1]]);
    puzzle.openPicker(touching);
    puzzle.fillIn(solution[touching]);
}));

canvasTest('cells selected for notes, highlighted', SIZE, () => pose((puzzle) => puzzle.select(EMPTY_CELLS.slice(0, 3))));

canvasTest('a number being chosen, its cell lit', SIZE, () => pose((puzzle) => puzzle.openPicker(EMPTY_CELLS[10])));

canvasTest('the glow rippling out of a grid just solved', SIZE, async () => {
    const puzzle = createPuzzleModel({ givens, solution });
    const view = makeBoard(puzzle);
    await advanceTime(16, view);
    for (const cell of EMPTY_CELLS) {
        puzzle.openPicker(cell);
        puzzle.fillIn(solution[cell]);
    }
    await advanceTime(260, view);
    return view;
});

/** The board of a puzzle that `play` has played in. */
async function pose(play: (puzzle: PuzzleModel) => void) {
    const puzzle = createPuzzleModel({ givens, solution });
    play(puzzle);
    const view = makeBoard(puzzle);
    await advanceTime(16, view);
    return view;
}

/** The board of `puzzle`, wired as the puzzle's screen wires it, on paper. */
function makeBoard(puzzle: PuzzleModel): Container {
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, SIZE.width, SIZE.height).fill(PAPER_COLOR));
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
    board.position.set(10, 10);
    view.addChild(board);
    return view;
}

/** Notes `digits` for `cells` as a group note, and selects nothing after. */
function note(puzzle: PuzzleModel, cells: readonly number[], digits: readonly number[]): void {
    puzzle.select(cells);
    for (const digit of digits) puzzle.toggleNote(digit);
    puzzle.select([]);
}
