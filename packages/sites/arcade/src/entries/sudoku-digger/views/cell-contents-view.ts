import { Container, Graphics, GraphicsContext, Text, type TextStyleOptions } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { CellKind } from '../models';
import { CELL_COUNT, COLUMN_OF, DIGIT_TEXTS, hasDigit, mixColors, ROW_OF } from '../sudoku-grid';
import { CELL_SIZE, DUG_FLASH_COLOR, GIVEN_COLOR, LOGIC_COLOR, MARK_COLOR, RUBBED_OUT_COLOR, SEARCH_COLOR, TEST_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What is in each cell, and how it moves and flashes. A set of digits is a mask with bit `d` set for each digit `d` in it. */
export interface CellContentsViewBindings {
    /** The digit in `cell`, or 0. */
    digitAt: (cell: number) => number;
    /** Where the digit in `cell` came from, which sets its colour. */
    cellKindAt: (cell: number) => CellKind;
    /** The pencil marks of `cell`, and those just rubbed out of it, which show in red. */
    candidatesAt: (cell: number) => number;
    eliminatedAt: (cell: number) => number;
    /** Whether `cell` holds a different digit in a second solution on show than in the full grid, and the full grid's digit. */
    isDifferentAt: (cell: number) => boolean;
    fullGridDigitAt: (cell: number) => number;
    /** The cell whose digits are being tried, which shows no digit of its own, or -1. */
    testedCell: () => number;
    /** How strongly each of `cell`'s flashes shows, from 0 to 1: a dead end's cross, a dug cell's fading digit, and a new digit's pop. */
    deadEndAt: (cell: number) => number;
    digFlashAt: (cell: number) => number;
    fadingDigitAt: (cell: number) => number;
    popAt: (cell: number) => number;
    /** How the cells move during a shuffle. See `ShuffleMotionViewModel`. */
    slideAt: (cell: number) => number;
    depthAt: (cell: number) => number;
    swapPulseFor: (digit: number) => number;
    /** How far the board is turned, which each cell turns back by, so its digits stay upright. */
    boardRotation: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * What each cell holds: its digit, coloured by where it came from, or its
 * pencil marks, a dead end's cross, and, while a second solution shows, an
 * outline and the full grid's digit small in a corner. Each cell's contents
 * sit on its middle, so they can turn and grow about it as the grid is
 * shuffled. Its origin is the grid's top left corner.
 */
export function CellContentsView(bindings: CellContentsViewBindings): Container {
    const view = new Container();
    const contents: Container[] = [];
    const digits: Text[] = [];
    const marks: Text[] = [];
    const crosses: Graphics[] = [];
    const differences: Graphics[] = [];
    const fullGridDigits: Text[] = [];
    // Every cell's cross, and its outline, share one drawing each, released with the view
    const crossDrawing = new GraphicsContext()
        .moveTo(-CROSS_SIZE, -CROSS_SIZE).lineTo(CROSS_SIZE, CROSS_SIZE)
        .moveTo(CROSS_SIZE, -CROSS_SIZE).lineTo(-CROSS_SIZE, CROSS_SIZE)
        .stroke({ color: RUBBED_OUT_COLOR, width: 3, cap: 'round' });
    const differenceDrawing = new GraphicsContext()
        .rect(-CELL_SIZE / 2 + 2.5, -CELL_SIZE / 2 + 2.5, CELL_SIZE - 5, CELL_SIZE - 5)
        .stroke({ color: TEST_COLOR, width: 2 });
    view.on('destroyed', () => {
        crossDrawing.destroy();
        differenceDrawing.destroy();
    });
    for (let cell = 0; cell < CELL_COUNT; cell++) createCell(cell);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const testedCell = bindings.testedCell();
        const uprightRotation = -bindings.boardRotation();
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            const digit = bindings.digitAt(cell);

            // Where the cell is drawn: its place, less the way a sliding column still has to go
            const content = contents[cell];
            content.x = COLUMN_OF[cell] * CELL_SIZE + bindings.slideAt(cell) + CELL_SIZE / 2;
            content.rotation = uprightRotation;
            // Of two columns crossing, one passes in front, growing, and the other behind, shrinking and fading
            const depth = bindings.depthAt(cell);
            content.scale.set(1 + depth * (depth > 0 ? FRONT_GROWTH : BACK_SHRINK));
            content.alpha = depth < 0 ? 1 + depth * BACK_FADE : 1;

            // A dead end's cross, while the cell it emptied stays empty
            const deadEnd = bindings.deadEndAt(cell);
            const cross = crosses[cell];
            cross.visible = deadEnd > 0 && digit === 0;
            cross.alpha = deadEnd;
            cross.scale.set(0.7 + deadEnd * 0.3);

            // A cell where a second solution differs from the full grid: outlined, with the full grid's digit in its corner
            const isDifferent = digit !== 0 && bindings.isDifferentAt(cell);
            const isTested = cell === testedCell;
            differences[cell].visible = isDifferent;
            fullGridDigits[cell].visible = isDifferent && !isTested;
            if (isDifferent) fullGridDigits[cell].text = DIGIT_TEXTS[bindings.fullGridDigitAt(cell)];

            // The digit, or the digit fading from a cell just dug
            const text = digits[cell];
            const digFlash = bindings.digFlashAt(cell);
            if (isTested) {
                // The tested cell shows its digits 3 by 3 instead
                text.text = '';
            }
            else if (digit !== 0) {
                const pulse = bindings.swapPulseFor(digit);
                text.text = DIGIT_TEXTS[digit];
                const kindColor = isDifferent ? TEST_COLOR : DIGIT_COLORS[bindings.cellKindAt(cell)];
                text.tint = mixColors(kindColor, DUG_FLASH_COLOR, pulse);
                text.alpha = 1;
                text.scale.set(1 + bindings.popAt(cell) * 0.5 + pulse * 0.3);
            }
            else if (digFlash > 0) {
                text.text = DIGIT_TEXTS[bindings.fadingDigitAt(cell)];
                text.tint = DUG_FLASH_COLOR;
                text.alpha = digFlash;
                text.scale.set(1 + (1 - digFlash) * 0.4);
            }
            else {
                text.text = '';
            }

            // The pencil marks, of an empty cell only
            const candidates = digit === 0 ? bindings.candidatesAt(cell) : 0;
            const eliminated = digit === 0 ? bindings.eliminatedAt(cell) : 0;
            for (let d = 1; d <= 9; d++) {
                const pencilMark = marks[cell * 9 + d - 1];
                pencilMark.visible = hasDigit(candidates | eliminated, d);
                pencilMark.tint = hasDigit(eliminated, d) ? RUBBED_OUT_COLOR : MARK_COLOR;
            }
        }
    }

    function createCell(cell: number): void {
        const content = new Container();
        content.position.set(COLUMN_OF[cell] * CELL_SIZE + CELL_SIZE / 2, ROW_OF[cell] * CELL_SIZE + CELL_SIZE / 2);
        const cross = new Graphics(crossDrawing);
        cross.visible = false;
        content.addChild(cross);
        crosses.push(cross);
        const difference = new Graphics(differenceDrawing);
        difference.visible = false;
        content.addChild(difference);
        differences.push(difference);
        const fullGridDigit = new Text({ text: '', style: MARK_STYLE, anchor: 0.5, visible: false, tint: GIVEN_COLOR });
        fullGridDigit.position.set(-CELL_SIZE / 2 + 8, -CELL_SIZE / 2 + 9);
        content.addChild(fullGridDigit);
        fullGridDigits.push(fullGridDigit);
        const digit = new Text({ text: '', style: DIGIT_STYLE, anchor: 0.5 });
        content.addChild(digit);
        digits.push(digit);
        for (let d = 1; d <= 9; d++) {
            const pencilMark = new Text({ text: DIGIT_TEXTS[d], style: MARK_STYLE, anchor: 0.5, visible: false });
            pencilMark.position.set((((d - 1) % 3) - 1) * MARK_SPACING, (Math.floor((d - 1) / 3) - 1) * MARK_SPACING);
            content.addChild(pencilMark);
            marks.push(pencilMark);
        }
        view.addChild(content);
        contents.push(content);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far a dead end's cross reaches from the cell's middle, each way, in pixels. */
const CROSS_SIZE = 9;
/** How far apart the pencil marks are, in pixels. */
const MARK_SPACING = 13;
/** As two columns cross, how much the front one's digits grow, and the back one's shrink and fade, at the crossing. */
const FRONT_GROWTH = 0.15;
const BACK_SHRINK = 0.3;
const BACK_FADE = 0.75;

const DIGIT_STYLE: TextStyleOptions = { fontFamily: 'monospace', fontSize: 26, fontWeight: 'bold', fill: 0xffffff };
const MARK_STYLE: TextStyleOptions = { fontFamily: 'monospace', fontSize: 11, fill: 0xffffff };

const DIGIT_COLORS: Readonly<Record<CellKind, number>> = {
    empty: GIVEN_COLOR,
    given: GIVEN_COLOR,
    search: SEARCH_COLOR,
    test: TEST_COLOR,
    logic: LOGIC_COLOR,
};
