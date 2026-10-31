import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { CellEvent, CellKind, DigMark, GridShuffling } from '../models';
import { COLUMN_OF, drawGridLines, ROW_OF } from '../sudoku-grid';
import { CellBackgroundsView } from './cell-backgrounds-view';
import { CellContentsView } from './cell-contents-view';
import { DigitTrialView } from './digit-trial-view';
import { createFlashesViewModel } from './flashes-view-model';
import { createShuffleMotionViewModel } from './shuffle-motion-view-model';
import { BOX_LINE_COLOR, CELL_SIZE, FOCUS_COLOR, GRID_SIZE, THIN_LINE_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/**
 * The grid's cells, what is in them, and the moments to flash. Cells are
 * numbered across each row from the top left, 0 to 80. A set of digits is a
 * mask with bit `d` set for each digit `d` in it. Each moment to flash is a
 * `CellEvent`, a record the model keeps and changes in place: the view
 * reads it once, and its fields every frame, and flashes the cell as its
 * count rises.
 */
export interface GridViewBindings {
    /** The digit in `cell`, or 0. */
    digitAt: (cell: number) => number;
    /** Where the digit in `cell` came from, which sets its colour. */
    cellKindAt: (cell: number) => CellKind;
    digMarkAt: (cell: number) => DigMark;
    /** Whether to tint each cell by what digging made of it. */
    areDigMarksShown: () => boolean;
    /** The pencil marks of `cell`: the digits that could still go there. */
    candidatesAt: (cell: number) => number;
    /** The pencil marks just rubbed out of `cell`, shown in red. */
    eliminatedAt: (cell: number) => number;
    /** Whether `cell` is one the last step of reasoning rests on. */
    isHighlightedAt: (cell: number) => boolean;
    /** Whether `cell` holds a different digit in a second solution on show than in the full grid. Such cells are outlined. */
    isDifferentAt: (cell: number) => boolean;
    /** The digit the full grid holds in `cell`, shown small in the corner of a cell that differs. */
    fullGridDigitAt: (cell: number) => number;
    /** The cell being dug, outlined with its row and column lit, or -1. */
    focusCell: () => number;
    /** The cell whose rival digits are being tried, shown 3 by 3 in place of its digit, or -1. */
    testedCell: () => number;
    /** The tested cell's own digit, its rivals, those ruled out, and the one being tried. See `DigitTrialView`. */
    ownDigit: () => number;
    rivalDigits: () => number;
    ruledOutDigits: () => number;
    testDigit: () => number;
    /** Dead ends the search has met. The cell of each flashes red. */
    deadEnds: CellEvent;
    /** Cells found needed, as another digit gave a second solution. Each pulses teal. */
    needed: CellEvent;
    /** Cells dug out. Each flashes gold as its digit fades. */
    dug: CellEvent;
    /** Seeds placed, and digits the grader placed. Each digit pops in. */
    seeds: CellEvent;
    placements: CellEvent;
    /** The shuffles, the last of which may be moving: what it swapped, two digits, two columns, or two stacks. */
    shuffle: GridShuffling;
    /** How far the last shuffle has moved, from 0 to 1. 1 when no shuffle is moving. */
    shuffleProgress: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The 9 by 9 grid. Each cell shows its digit, coloured by where it came
 * from, or its pencil marks while the puzzle is graded. The cell being dug
 * is outlined, and as the digits that could take its digit's place are
 * tried, it shows its digits 3 by 3, crossing each out as it leads nowhere.
 * A dead end flashes red, with a cross in the cell the search emptied, and
 * shakes the grid. A dug cell flashes gold as its digit fades, and a new
 * digit pops in. While a second solution shows, the cells where it differs
 * from the full grid are outlined, with the full grid's digit small in a
 * corner, and the cell found needed pulses teal. While the grid is
 * shuffled, the columns that swap slide past each other, the digits that
 * swap pulse, and a turn turns the whole grid, shrinking it to fit as it
 * tilts, its digits staying upright. Its origin is the grid's top left
 * corner.
 *
 * It is made of layers: the cells' backgrounds, the lines, the cells'
 * contents, the digits being tried, and the outline of the cell being dug.
 * Two view models hold what the layers share: the flashes, which are
 * presentation state the view advances in its update step, and the
 * shuffle's motion, worked out from how far the shuffle has gone.
 */
export function GridView(bindings: GridViewBindings): Container {
    const view = new Container();
    view.label = 'grid';
    const flashes = createFlashesViewModel({
        deadEnds: bindings.deadEnds,
        dug: bindings.dug,
        needed: bindings.needed,
        seeds: bindings.seeds,
        placements: bindings.placements,
    });
    const motion = createShuffleMotionViewModel({ shuffle: bindings.shuffle, progress: bindings.shuffleProgress });

    // The board turns about its middle during a turn
    const board = new Container();
    board.pivot.set(GRID_SIZE / 2, GRID_SIZE / 2);
    board.position.set(GRID_SIZE / 2, GRID_SIZE / 2);
    view.addChild(board);
    const backgrounds = CellBackgroundsView({
        digMarkAt: bindings.digMarkAt,
        areDigMarksShown: bindings.areDigMarksShown,
        focusCell: bindings.focusCell,
        isHighlightedAt: bindings.isHighlightedAt,
        neededPulseAt: flashes.neededPulseAt,
        digFlashAt: flashes.digFlashAt,
        deadEndAt: flashes.deadEndAt,
        slideAt: motion.slideAt,
    });
    const lines = drawGridLines(new Graphics(), { cellSize: CELL_SIZE, thinColor: THIN_LINE_COLOR, boxColor: BOX_LINE_COLOR, boxWidth: 2, boxEnds: 'butt' });
    const contents = CellContentsView({
        digitAt: bindings.digitAt,
        cellKindAt: bindings.cellKindAt,
        candidatesAt: bindings.candidatesAt,
        eliminatedAt: bindings.eliminatedAt,
        isDifferentAt: bindings.isDifferentAt,
        fullGridDigitAt: bindings.fullGridDigitAt,
        testedCell: bindings.testedCell,
        deadEndAt: flashes.deadEndAt,
        digFlashAt: flashes.digFlashAt,
        fadingDigitAt: flashes.fadingDigitAt,
        popAt: flashes.popAt,
        slideAt: motion.slideAt,
        depthAt: motion.depthAt,
        swapPulseFor: motion.swapPulseFor,
        boardRotation: () => board.rotation,
    });
    const trial = DigitTrialView({
        ownDigit: bindings.ownDigit,
        rivalDigits: bindings.rivalDigits,
        ruledOutDigits: bindings.ruledOutDigits,
        testDigit: bindings.testDigit,
    });
    const focus = new Graphics().rect(1.5, 1.5, CELL_SIZE - 3, CELL_SIZE - 3).stroke({ color: FOCUS_COLOR, width: 3 });
    board.addChild(backgrounds, lines, contents, trial, focus);

    setUpdate(view, flashes.update);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const focusCell = bindings.focusCell();
        focus.visible = focusCell >= 0;
        if (focusCell >= 0) focus.position.set(xOf(focusCell), yOf(focusCell));
        const testedCell = bindings.testedCell();
        trial.visible = testedCell >= 0;
        if (testedCell >= 0) trial.position.set(xOf(testedCell) + CELL_SIZE / 2, yOf(testedCell) + CELL_SIZE / 2);
        board.rotation = motion.rotation;
        board.scale.set(motion.scale);
        board.position.set(GRID_SIZE / 2 + flashes.shakeX, GRID_SIZE / 2 + flashes.shakeY);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function xOf(cell: number): number {
    return COLUMN_OF[cell] * CELL_SIZE;
}

function yOf(cell: number): number {
    return ROW_OF[cell] * CELL_SIZE;
}
