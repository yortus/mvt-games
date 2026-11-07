import { Container, Graphics, Rectangle } from 'pixi.js';
import { listenToPointer } from '@mvtjs/site-kit/shared';
import { createComputed } from '@mvtjs/utils';
import { THIN_LINE_COLOR } from '../../../shared';
import { drawGridLines } from '../generator';
import type { GroupNote } from '../models';
import { BoardCellsView } from './board-cells-view';
import { BoardDigitsView } from './board-digits-view';
import { createBoardGesturesViewModel } from './board-gestures-view-model';
import { layOutGroupNotes } from './group-note-layout';
import { GroupNotesView } from './group-notes-view';
import { PencilMarksView } from './pencil-marks-view';
import { BOX_LINE_COLOR, CELL_SIZE, GRID_SIZE } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** The grid of a puzzle being played. */
export interface BoardViewBindings {
    /** The digit in `cell`, given or filled in, or 0. */
    digitAt: (cell: number) => number;
    isGivenAt: (cell: number) => boolean;
    /** Whether the digit in `cell` breaks a rule, which shows it in red. */
    isClashAt: (cell: number) => boolean;
    /** The digits pencilled into `cell`, as a set: bit `d` is set for each digit `d`. */
    marksAt: (cell: number) => number;
    /** The group notes, drawn over the grid, each with a label to tap. */
    groupNotes: () => readonly GroupNote[];
    /** The cells selected, lit: empty cells for notes, or one filled in, to change or clear. */
    selection: () => readonly number[];
    /** A count that rises as each puzzle opens, so the group notes are laid out afresh. */
    puzzlesOpened: () => number;
    /** Whether the puzzle is solved. As it becomes solved, a glow ripples out from the grid's middle. */
    isSolved: () => boolean;
    /** A count that rises with every action finished, so the group notes are laid out again only as they may have changed. */
    changes: () => number;
    /** The player tapped `cell`. */
    onCellTapped?: (cell: number) => void;
    /** The player tapped `note`'s label. */
    onNoteLabelTapped?: (note: GroupNote) => void;
    /** The player dragged through `cells`, so far, in the order the drag took them in. */
    onCellsDragged?: (cells: readonly number[]) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The grid, its digits, and the notes made in it: pencil marks and group
 * notes. The player taps a cell or a group note's label, or drags through
 * cells, and what each does to the selection is up to whoever the board
 * reports to. A drag takes in every cell it passes through the middle of,
 * so it can run past a cell's corner without taking it in. Its origin is
 * the grid's top left corner.
 *
 * It is made of layers: the cells, the lines, the pencil marks, the group
 * notes and the digits. The group notes are laid out once each time they
 * change, and both their layer and the board's test for a tap on a label
 * read that layout. Which cells the taps and drags choose is the gestures
 * view model's to say: the board only turns pointer events into positions
 * in cells.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const view = new Container();
    view.label = 'board';
    view.cursor = 'pointer';
    view.hitArea = new Rectangle(0, 0, GRID_SIZE, GRID_SIZE);

    const isFilledAt = (cell: number): boolean => bindings.digitAt(cell) !== 0;
    const layouts = createComputed({
        watch: { changes: bindings.changes, opened: bindings.puzzlesOpened },
        compute: () => layOutGroupNotes(bindings.groupNotes(), isFilledAt),
    });
    const gestures = createBoardGesturesViewModel({
        labelNoteAt: findLabelNoteAt,
        onCellTapped: (cell) => bindings.onCellTapped?.(cell),
        onNoteLabelTapped: (note) => bindings.onNoteLabelTapped?.(note),
        onCellsDragged: (cells) => bindings.onCellsDragged?.(cells),
    });

    // The group notes go under the digits, so a note's line passes behind a filled cell's digit. Their labels never cover one
    view.addChild(
        BoardCellsView({
            digitAt: bindings.digitAt,
            isGivenAt: bindings.isGivenAt,
            isClashAt: bindings.isClashAt,
            selection: bindings.selection,
            isSolved: bindings.isSolved,
            puzzlesOpened: bindings.puzzlesOpened,
        }),
        drawGridLines(new Graphics(), { cellSize: CELL_SIZE, thinColor: THIN_LINE_COLOR, boxColor: BOX_LINE_COLOR, boxWidth: 2.5, boxEnds: 'square' }),
        PencilMarksView({ marksAt: (cell) => (isFilledAt(cell) ? 0 : bindings.marksAt(cell)) }),
        GroupNotesView({ layouts, digitAt: bindings.digitAt }),
        BoardDigitsView({ digitAt: bindings.digitAt, isGivenAt: bindings.isGivenAt, isClashAt: bindings.isClashAt }),
    );

    listenToPointer({
        target: view,
        onPressed: (x, y) => gestures.press(x / CELL_SIZE, y / CELL_SIZE),
        onMoved: (x, y) => gestures.move(x / CELL_SIZE, y / CELL_SIZE),
        onReleased: () => gestures.release(),
        onCancelled: () => gestures.cancel(),
    });
    return view;

    /** The group note whose label is at (`x`, `y`), in cells, if one is shown there: the last drawn, if they overlap. */
    function findLabelNoteAt(x: number, y: number): GroupNote | undefined {
        const shown = layouts();
        for (let i = shown.length - 1; i >= 0; i--) {
            const { note, labelX, labelY, labelWidth } = shown[i];
            const reachX = labelWidth / CELL_SIZE / 2 + LABEL_MARGIN;
            if (Math.abs(x - labelX) < reachX && Math.abs(y - labelY) < LABEL_REACH_Y) return note;
        }
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How near a group note's label a tap must be to select its cells, in cells: how far beyond its ends, and how far above or below its middle. */
const LABEL_MARGIN = 0.06;
const LABEL_REACH_Y = 0.22;
