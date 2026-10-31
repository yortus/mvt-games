import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import type { CellEvent, CellKind, DigMark, ShuffleKind } from '../../models';
import { GridView, type GridViewBindings } from '../grid-view';
import { GRID_SIZE } from '../view-constants';

const SIZE = { width: GRID_SIZE, height: GRID_SIZE, pixelArt: false };

// The top two rows dug and kept, the cell at row 3, column 5 being tested, and the search's digits below it
canvasTest('digging, with the cell being tested outlined', SIZE, () => GridView(createBindings({
    digitAt: (cell) => (cell < 18 && cell % 3 === 0 ? 0 : digitOf(cell)),
    cellKindAt: (cell) => (cell === 22 ? 'test' : cell > 22 && cell % 2 === 0 ? 'search' : 'given'),
    digMarkAt: (cell) => (cell >= 18 ? 'none' : MARKS[cell % 3]),
    focusCell: () => 22,
})));

// A box's pencil marks, the 4s rubbed out of the row beside the lit cells
canvasTest('grading, with pencil marks rubbed out', SIZE, () => GridView(createBindings({
    digitAt: (cell) => (isInTopRows(cell) ? 0 : digitOf(cell)),
    cellKindAt: (cell) => (cell % 4 === 0 ? 'logic' : 'given'),
    candidatesAt: (cell) => (isInTopRows(cell) ? 0b0110110100 : 0),
    eliminatedAt: (cell) => (cell >= 3 && cell < 9 ? 1 << 4 : 0),
    isHighlightedAt: (cell) => cell === 9 || cell === 10,
})));

canvasTest('two columns half way through swapping', SIZE, () => GridView(createBindings({
    shuffle: shuffled('columns', 3, 5),
    shuffleProgress: () => 0.5,
})));

canvasTest('two digits half way through swapping', SIZE, () => GridView(createBindings({
    shuffle: shuffled('digits', 2, 7),
    shuffleProgress: () => 0.5,
})));

canvasTest('a third of the way through a turn', SIZE, () => GridView(createBindings({
    shuffle: shuffled('turn', 0, 0),
    shuffleProgress: () => 0.33,
})));

// A second solution, swapping the 1s and 2s of four cells in the top two rows, the cell being dug kept and pulsing
canvasTest('a second solution, its differences marked', SIZE, async () => {
    const needed = { count: 0, cell: 0, digit: digitOf(0) };
    const isSwapped = (cell: number) => cell === 0 || cell === 1 || cell === 9 + 6 || cell === 9 + 7;
    const view = GridView(createBindings({
        digitAt: (cell) => (isSwapped(cell) ? 3 - digitOf(cell) : digitOf(cell)),
        cellKindAt: (cell) => (cell === 0 ? 'test' : cell > 30 && cell % 3 === 0 ? 'search' : 'given'),
        digMarkAt: (cell) => (cell === 0 ? 'needed' : 'none'),
        isDifferentAt: isSwapped,
        fullGridDigitAt: digitOf,
        focusCell: () => 0,
        needed,
    }));
    await advanceTime(16, view);
    needed.count = 1;
    await advanceTime(150, view);
    return view;
});

// A dead end at the top left, its cross fading and the grid shaking, a cell dug out beside it, and a seed popping in,
// a moment after each
canvasTest('a dead end, a dug cell and a seed, flashing', SIZE, async () => {
    const deadEnds = { count: 0, cell: 0, digit: 0 };
    const dug = { count: 0, cell: 1, digit: digitOf(1) };
    const seeds = { count: 0, cell: 2, digit: digitOf(2) };
    const view = GridView(createBindings({ digitAt: (cell) => (cell <= 1 ? 0 : digitOf(cell)), deadEnds, dug, seeds }));
    await advanceTime(16, view);
    deadEnds.count = 1;
    dug.count = 1;
    seeds.count = 1;
    await advanceTime(100, view);
    return view;
});

/** A full, valid grid: each row is the one above it shifted along, by three across a box and by one at each box's foot. */
function digitOf(cell: number): number {
    const row = Math.floor(cell / 9);
    return ((row * 3 + Math.floor(row / 3) + (cell % 9)) % 9) + 1;
}

function isInTopRows(cell: number): boolean {
    return cell < 18;
}

const MARKS: readonly DigMark[] = ['dug', 'needed', 'held'];

/** A shuffle of `kind` that swapped `first` and `second`. */
function shuffled(kind: ShuffleKind, first: number, second: number) {
    return { kind, first, second, count: 1 };
}

/** A moment that never comes. */
const NOTHING: CellEvent = { count: 0, cell: -1, digit: 0 };

/** Bindings for the full grid, all givens, still, unless `overrides` says otherwise. */
function createBindings(overrides: Partial<GridViewBindings>): GridViewBindings {
    return {
        digitAt: digitOf,
        cellKindAt: (): CellKind => 'given',
        digMarkAt: (): DigMark => 'none',
        areDigMarksShown: () => true,
        candidatesAt: () => 0,
        eliminatedAt: () => 0,
        isHighlightedAt: () => false,
        isDifferentAt: () => false,
        fullGridDigitAt: () => 0,
        focusCell: () => -1,
        testedCell: () => -1,
        ownDigit: () => 0,
        rivalDigits: () => 0,
        ruledOutDigits: () => 0,
        testDigit: () => 0,
        deadEnds: NOTHING,
        needed: NOTHING,
        dug: NOTHING,
        seeds: NOTHING,
        placements: NOTHING,
        shuffle: { kind: undefined, first: 0, second: 0, count: 0 },
        shuffleProgress: () => 1,
        ...overrides,
    };
}
