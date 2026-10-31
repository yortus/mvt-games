import { Container, Sprite, Texture } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { DigMark } from '../models';
import { CELL_COUNT, COLUMN_OF, mixColors, ROW_OF } from '../sudoku-grid';
import {
    CELL_COLOR, CELL_SIZE, DUG_COLOR, DUG_FLASH_COLOR, HELD_COLOR, HIGHLIGHT_COLOR, NEEDED_COLOR, NEEDED_PULSE_COLOR, PEER_COLOR,
    RUBBED_OUT_COLOR,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CellBackgroundsViewBindings {
    /** What digging made of `cell`, which tints it, while dig marks show. */
    digMarkAt: (cell: number) => DigMark;
    areDigMarksShown: () => boolean;
    /** The cell being dug, whose row and column are lit, or -1. */
    focusCell: () => number;
    /** Whether `cell` is one the last step of reasoning rests on, which lights it. */
    isHighlightedAt: (cell: number) => boolean;
    /** How strongly each of `cell`'s flashes shows, from 0 to 1: a needed cell's pulse, a dug cell's, and a dead end's. */
    neededPulseAt: (cell: number) => number;
    digFlashAt: (cell: number) => number;
    deadEndAt: (cell: number) => number;
    /** How far `cell` has slid from its place during a shuffle, in pixels. */
    slideAt: (cell: number) => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The grid's cells, each a square coloured by what digging made of it, lit
 * by the reasoning or by the cell being dug, and flashing as things happen
 * to it. Its origin is the grid's top left corner.
 */
export function CellBackgroundsView(bindings: CellBackgroundsViewBindings): Container {
    const view = new Container();
    const backgrounds: Sprite[] = [];
    for (let cell = 0; cell < CELL_COUNT; cell++) {
        const background = new Sprite({ texture: Texture.WHITE, width: CELL_SIZE - 1, height: CELL_SIZE - 1, tint: CELL_COLOR });
        background.position.set(COLUMN_OF[cell] * CELL_SIZE + 1, ROW_OF[cell] * CELL_SIZE + 1);
        view.addChild(background);
        backgrounds.push(background);
    }
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const focusCell = bindings.focusCell();
        const areDigMarksShown = bindings.areDigMarksShown();
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            let color = CELL_COLOR;
            const mark = areDigMarksShown ? bindings.digMarkAt(cell) : 'none';
            if (mark === 'dug') color = DUG_COLOR;
            else if (mark === 'needed') color = NEEDED_COLOR;
            else if (mark === 'held') color = HELD_COLOR;
            else if (focusCell >= 0 && (ROW_OF[cell] === ROW_OF[focusCell] || COLUMN_OF[cell] === COLUMN_OF[focusCell])) color = PEER_COLOR;
            if (bindings.isHighlightedAt(cell)) color = HIGHLIGHT_COLOR;
            color = mixColors(color, NEEDED_PULSE_COLOR, bindings.neededPulseAt(cell) * 0.8);
            color = mixColors(color, DUG_FLASH_COLOR, bindings.digFlashAt(cell) * 0.5);
            color = mixColors(color, RUBBED_OUT_COLOR, bindings.deadEndAt(cell) * 0.6);
            backgrounds[cell].tint = color;
            backgrounds[cell].x = COLUMN_OF[cell] * CELL_SIZE + bindings.slideAt(cell) + 1;
        }
    }
}
