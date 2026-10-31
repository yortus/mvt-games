import { Container, type FederatedPointerEvent, Graphics, Rectangle } from 'pixi.js';
import { setUpdate } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';
import { drawGridLines } from '#sudoku-digger';
import type { GroupNote } from '../models';
import { BoardCellsView } from './board-cells-view';
import { BoardDigitsView } from './board-digits-view';
import { createBoardGesturesViewModel } from './board-gestures-view-model';
import { layOutGroupNotes } from './group-note-layout';
import { GroupNotesView } from './group-notes-view';
import { PencilMarksView } from './pencil-marks-view';
import { BOX_LINE_COLOR, CELL_SIZE, GRID_SIZE, THIN_LINE_COLOR } from './view-constants';

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
    /** The group notes, drawn over the grid. Tapping one's label selects its cells. */
    groupNotes: () => readonly GroupNote[];
    /** The cells selected for notes, lit. */
    selection: () => readonly number[];
    /** A count that rises as each puzzle opens, so the group notes are laid out afresh. */
    puzzlesOpened: () => number;
    /** The cell whose number is being chosen, lit, or -1. */
    pickerCell: () => number;
    /** Whether the puzzle is solved. As it becomes solved, a glow ripples out from the grid's middle. */
    isSolved: () => boolean;
    /** A count that rises with every action finished, so the group notes are laid out again only as they may have changed. */
    changes: () => number;
    /** The player chose these cells for notes, or none, with a tap or a drag. */
    onSelected: (cells: readonly number[]) => void;
    /** The player tapped `cell` twice, quickly. */
    onCellDoubleTapped: (cell: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The grid, its digits, and the notes made in it: pencil marks and group
 * notes. A tap selects a cell, or takes one out of several selected, or
 * clears the one selected. A drag selects every cell it passes through the
 * middle of, so it can run past a cell's corner without taking it in. A tap
 * on a group note's label selects its cells. Tapping a cell twice, quickly,
 * opens the choice of its number. Its origin is the grid's top left corner.
 *
 * It is made of layers: the cells, the lines, the pencil marks, the group
 * notes and the digits. The group notes are laid out once each time they
 * change, and both their layer and the board's test for a tap on a label
 * read that layout. What the taps and drags mean is the gestures view
 * model's to say: the board only turns pointer events into cells.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const view = new Container();
    view.label = 'board';
    view.eventMode = 'static';
    view.cursor = 'pointer';
    view.hitArea = new Rectangle(0, 0, GRID_SIZE, GRID_SIZE);

    const isFilledAt = (cell: number): boolean => bindings.digitAt(cell) !== 0;
    const layouts = createComputed({
        watch: { changes: bindings.changes, opened: bindings.puzzlesOpened },
        compute: () => layOutGroupNotes(bindings.groupNotes(), isFilledAt),
    });
    const gestures = createBoardGesturesViewModel({
        selection: bindings.selection,
        labelNoteAt: findLabelNoteAt,
        onSelected: bindings.onSelected,
        onCellDoubleTapped: bindings.onCellDoubleTapped,
    });

    // The group notes go under the digits, so a note's line passes behind a filled cell's digit. Their labels never cover one
    view.addChild(
        BoardCellsView({
            digitAt: bindings.digitAt,
            isGivenAt: bindings.isGivenAt,
            isClashAt: bindings.isClashAt,
            selection: bindings.selection,
            pickerCell: bindings.pickerCell,
            isSolved: bindings.isSolved,
            puzzlesOpened: bindings.puzzlesOpened,
        }),
        drawGridLines(new Graphics(), { cellSize: CELL_SIZE, thinColor: THIN_LINE_COLOR, boxColor: BOX_LINE_COLOR, boxWidth: 2.5, boxEnds: 'square' }),
        PencilMarksView({ marksAt: (cell) => (isFilledAt(cell) ? 0 : bindings.marksAt(cell)) }),
        GroupNotesView({ layouts, digitAt: bindings.digitAt }),
        BoardDigitsView({ digitAt: bindings.digitAt, isGivenAt: bindings.isGivenAt, isClashAt: bindings.isClashAt }),
    );

    view.on('pointerdown', (e) => gestures.press(e.pointerId, ...toGrid(e)));
    view.on('globalpointermove', (e) => gestures.move(e.pointerId, ...toGrid(e)));
    view.on('pointerup', (e) => gestures.release(e.pointerId));
    view.on('pointerupoutside', (e) => gestures.release(e.pointerId));
    view.on('pointercancel', (e) => gestures.release(e.pointerId));
    setUpdate(view, gestures.update);
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

    /** Where the pointer is on the grid, in cells, across and down. */
    function toGrid(e: FederatedPointerEvent): [x: number, y: number] {
        const { x, y } = e.getLocalPosition(view);
        return [x / CELL_SIZE, y / CELL_SIZE];
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How near a group note's label a tap must be to select its cells, in cells: how far beyond its ends, and how far above or below its middle. */
const LABEL_MARGIN = 0.06;
const LABEL_REACH_Y = 0.22;
