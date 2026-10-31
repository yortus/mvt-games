import { Container, Text, type TextStyleOptions } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { CELL_COUNT, COLUMN_OF, DIGIT_TEXTS, hasDigit, ROW_OF } from '#sudoku-digger';
import { CELL_SIZE, FONT_FAMILY, PENCIL_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PencilMarksViewBindings {
    /** The digits pencilled into `cell`, as a set: bit `d` is set for each digit `d`. */
    marksAt: (cell: number) => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** Each cell's pencil marks, small, each digit in its own ninth of the cell, 1 to 9 across and down. Its origin is the grid's top left corner. */
export function PencilMarksView(bindings: PencilMarksViewBindings): Container {
    const view = new Container();
    const marks: Text[] = [];
    for (let cell = 0; cell < CELL_COUNT; cell++) {
        for (let digit = 1; digit <= 9; digit++) {
            const x = (COLUMN_OF[cell] + (((digit - 1) % 3) + 0.5) / 3) * CELL_SIZE;
            const y = (ROW_OF[cell] + (Math.floor((digit - 1) / 3) + 0.5) / 3) * CELL_SIZE;
            const mark = new Text({ text: DIGIT_TEXTS[digit], style: MARK_STYLE, anchor: 0.5, x, y: y + 0.5, tint: PENCIL_COLOR, visible: false });
            view.addChild(mark);
            marks.push(mark);
        }
    }
    // The marks each cell shows, so they are set only as they change
    const shownMarks = new Uint16Array(CELL_COUNT);

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            const cellMarks = bindings.marksAt(cell);
            if (cellMarks === shownMarks[cell]) continue;
            shownMarks[cell] = cellMarks;
            for (let d = 1; d <= 9; d++) marks[cell * 9 + d - 1].visible = hasDigit(cellMarks, d);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MARK_STYLE: TextStyleOptions = { fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: '600', fill: 0xffffff };
