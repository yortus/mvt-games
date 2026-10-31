import { Container, Text, type TextStyleOptions } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { CELL_COUNT, COLUMN_OF, DIGIT_TEXTS, ROW_OF } from '#sudoku-digger';
import { ANSWER_COLOR, CELL_SIZE, CLASH_COLOR, FONT_FAMILY, INK_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BoardDigitsViewBindings {
    /** The digit in `cell`, given or filled in, or 0. */
    digitAt: (cell: number) => number;
    /** Whether `cell`'s digit is given, which shows it in ink, and an answer otherwise. */
    isGivenAt: (cell: number) => boolean;
    /** Whether the digit in `cell` breaks a rule, which shows it in red. */
    isClashAt: (cell: number) => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The digits in the grid's cells: the givens in ink, the answers in their own colour, and any that break a rule in red. */
export function BoardDigitsView(bindings: BoardDigitsViewBindings): Container {
    const view = new Container();
    const digits: Text[] = [];
    for (let cell = 0; cell < CELL_COUNT; cell++) {
        const x = COLUMN_OF[cell] * CELL_SIZE + CELL_SIZE / 2;
        const y = ROW_OF[cell] * CELL_SIZE + CELL_SIZE / 2 + 1;
        const digit = new Text({ text: '', style: DIGIT_STYLE, anchor: 0.5, x, y });
        view.addChild(digit);
        digits.push(digit);
    }
    // The digit each cell shows, so its text is set only as it changes
    const shownDigits = new Uint8Array(CELL_COUNT);

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            const digit = bindings.digitAt(cell);
            if (digit !== shownDigits[cell]) {
                shownDigits[cell] = digit;
                digits[cell].text = DIGIT_TEXTS[digit];
            }
            const isClash = digit !== 0 && bindings.isClashAt(cell);
            digits[cell].tint = isClash ? CLASH_COLOR : bindings.isGivenAt(cell) ? INK_COLOR : ANSWER_COLOR;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DIGIT_STYLE: TextStyleOptions = { fontFamily: FONT_FAMILY, fontSize: 32, fill: 0xffffff };
