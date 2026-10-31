import { Container, Sprite, Texture } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import { CELL_COUNT, COLUMN_OF, mixColors, ROW_OF } from '#sudoku-digger';
import {
    CARD_COLOR, CELL_SIZE, CLASH_CELL_COLOR, GIVEN_CELL_COLOR, PICKING_CELL_COLOR, SELECTED_CELL_COLOR, SOLVED_GLOW_COLOR,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BoardCellsViewBindings {
    /** The digit in `cell`, given or filled in, or 0. */
    digitAt: (cell: number) => number;
    isGivenAt: (cell: number) => boolean;
    /** Whether the digit in `cell` breaks a rule. */
    isClashAt: (cell: number) => boolean;
    /** The cells selected for notes. */
    selection: () => readonly number[];
    /** The cell whose number is being chosen, or -1. */
    pickerCell: () => number;
    /** Whether the puzzle is solved. As it becomes solved, a glow ripples out from the grid's middle. */
    isSolved: () => boolean;
    /** A count that rises as each puzzle opens. A puzzle opened already solved has no glow. */
    puzzlesOpened: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The grid's cells, each a square shaded by what it is: given, selected,
 * being chosen, or holding an answer that breaks a rule. As the puzzle is
 * solved, a glow ripples out across them from the middle. Its origin is the
 * grid's top left corner.
 */
export function BoardCellsView(bindings: BoardCellsViewBindings): Container {
    const view = new Container();
    const cells: Sprite[] = [];
    for (let cell = 0; cell < CELL_COUNT; cell++) {
        const x = COLUMN_OF[cell] * CELL_SIZE;
        const y = ROW_OF[cell] * CELL_SIZE;
        const background = new Sprite({ texture: Texture.WHITE, x, y, width: CELL_SIZE, height: CELL_SIZE });
        view.addChild(background);
        cells.push(background);
    }

    // Presentation state: how long since the puzzle was solved, for its glow
    let glowMs = GLOW_DONE_MS;
    const watcher = watch({ isSolved: bindings.isSolved, opened: bindings.puzzlesOpened });

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        const w = watcher.poll();
        if (w.isSolved.changed && w.isSolved.current && !w.opened.changed) glowMs = 0;
        glowMs = Math.min(GLOW_DONE_MS, glowMs + deltaMs);
    }

    function refresh(): void {
        const pickerCell = bindings.pickerCell();
        const selection = bindings.selection();
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            const isGiven = bindings.isGivenAt(cell);
            const isClash = bindings.digitAt(cell) !== 0 && bindings.isClashAt(cell);
            cells[cell].tint = mixColors(findCellColor(cell, pickerCell, selection, isGiven, isClash), SOLVED_GLOW_COLOR, glowAt(cell));
        }
    }

    /** How strongly `cell` glows, from 0 to 1, as the glow ripples out from the middle of a grid just solved. */
    function glowAt(cell: number): number {
        if (glowMs >= GLOW_DONE_MS) return 0;
        const distance = Math.hypot(COLUMN_OF[cell] - 4, ROW_OF[cell] - 4);
        const progress = (glowMs - distance * GLOW_STEP_MS) / GLOW_FLASH_MS;
        return progress <= 0 || progress >= 1 ? 0 : Math.sin(progress * Math.PI);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How the glow of a grid just solved ripples out: how long after the middle each step out lights, and how long each cell glows, in ms. */
const GLOW_STEP_MS = 70;
const GLOW_FLASH_MS = 450;
const GLOW_DONE_MS = GLOW_STEP_MS * 6 + GLOW_FLASH_MS;

function findCellColor(cell: number, pickerCell: number, selection: readonly number[], isGiven: boolean, isClash: boolean): number {
    if (cell === pickerCell) return PICKING_CELL_COLOR;
    if (selection.includes(cell)) return SELECTED_CELL_COLOR;
    if (isClash && !isGiven) return CLASH_CELL_COLOR;
    return isGiven ? GIVEN_CELL_COLOR : CARD_COLOR;
}
