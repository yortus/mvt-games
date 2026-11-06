/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import { ButtonView, DIM_TEXT_COLOR, INK_COLOR, LABEL_STYLE, LEVEL_NAMES, MARGIN, SMALL_STYLE, SOLVED_COLOR, writeDate } from '../../../shared';
import type { PuzzleModel, GameModel } from '../models';
import { BoardView } from './board-view';
import { KeypadView } from './keypad-view';
import { BACK_WIDTH, BAR_BUTTON_HEIGHT, BAR_Y, GRID_X, GRID_Y, HINT_Y, KEYPAD_Y, SCREEN_WIDTH, TOOL_GAP, TOOL_HEIGHT, TOOL_WIDTH, TOOL_Y } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PuzzleViewBindings {
    /** The game, which has a puzzle open whenever this view shows. */
    model: GameModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The puzzle's screen: the way back to the calendar, the puzzle's date and
 * level, the grid, a keypad for noting digits in the cells selected, and
 * for filling in the one cell selected by holding a key, undo, and how to
 * play. A line of help along the bottom says what to do next, and that the
 * puzzle is solved once it is. The practice puzzle of a walkthrough says so
 * in place of its date.
 */
export function PuzzleView(bindings: PuzzleViewBindings): Container {
    const { model } = bindings;
    // The view shows only while a puzzle is open, so its bindings never run without one
    const puzzle = (): PuzzleModel => model.puzzle!;
    const isPractice = (): boolean => model.intro.practice !== undefined;
    const dateText = createComputed({
        watch: { day: () => model.puzzleDay, isPractice },
        compute: ({ day, isPractice: practising }) => (practising ? 'Practice puzzle' : writeDate(day)),
    });
    const levelText = createComputed({
        watch: { level: () => model.puzzleLevel, isPractice },
        compute: ({ level, isPractice: practising }) => (practising ? 'Nothing here is kept' : `${LEVEL_NAMES[level]} puzzle`),
    });
    const isSolved = (): boolean => puzzle().isSolved;
    const hintText = createComputed({
        watch: {
            isSolved,
            selected: () => puzzle().selection.length,
            isFilled: () => puzzle().selection.length === 1 && puzzle().digitAt(puzzle().selection[0]) !== 0,
            canNote: () => puzzle().canNoteSelection,
        },
        compute: writeHint,
    });
    return (
        <container>
            <ButtonView
                x={MARGIN}
                y={BAR_Y}
                width={BACK_WIDTH}
                height={BAR_BUTTON_HEIGHT}
                label="‹ Calendar"
                onPressed={model.closePuzzle}
            />
            <text text={dateText} x={SCREEN_WIDTH - MARGIN} y={BAR_Y + 12} anchorX={1} anchorY={0.5} style={LABEL_STYLE} tint={INK_COLOR} />
            <text text={levelText} x={SCREEN_WIDTH - MARGIN} y={BAR_Y + 34} anchorX={1} anchorY={0.5} style={SMALL_STYLE} tint={DIM_TEXT_COLOR} />
            <container x={GRID_X} y={GRID_Y}>
                <BoardView
                    digitAt={(cell) => puzzle().digitAt(cell)}
                    isGivenAt={(cell) => puzzle().isGivenAt(cell)}
                    isClashAt={(cell) => puzzle().isClashAt(cell)}
                    marksAt={(cell) => puzzle().marksAt(cell)}
                    groupNotes={() => puzzle().groupNotes}
                    selection={() => puzzle().selection}
                    onSelected={(cells) => puzzle().select(cells)}
                    puzzlesOpened={() => model.puzzlesOpened}
                    isSolved={isSolved}
                    changes={() => puzzle().changes}
                />
            </container>
            <container x={GRID_X} y={KEYPAD_Y}>
                <KeypadView
                    digits={() => puzzle().selectionDigits}
                    isEnabled={() => puzzle().canNoteSelection || canFill()}
                    canFill={canFill}
                    onTapped={(digit) => puzzle().toggleNote(digit)}
                    onHeld={fillOrClear}
                />
            </container>
            <ButtonView
                x={GRID_X}
                y={TOOL_Y}
                width={TOOL_WIDTH}
                height={TOOL_HEIGHT}
                label="Undo"
                isEnabled={() => !isSolved() && puzzle().undoCount > 0}
                onPressed={() => puzzle().undo()}
            />
            <ButtonView
                x={GRID_X + TOOL_WIDTH + TOOL_GAP}
                y={TOOL_Y}
                width={TOOL_WIDTH}
                height={TOOL_HEIGHT}
                label="How to play"
                onPressed={model.intro.showCard}
            />
            <text
                text={hintText}
                x={SCREEN_WIDTH / 2}
                y={HINT_Y}
                anchor={0.5}
                style={SMALL_STYLE}
                tint={() => (isSolved() ? SOLVED_COLOR : DIM_TEXT_COLOR)}
            />
        </container>
    );

    /** Whether holding a digit's key fills a cell: one cell is selected, and the puzzle is not solved. */
    function canFill(): boolean {
        return !isSolved() && puzzle().selection.length === 1;
    }

    /** What holding a digit's key does: fills the cell selected with it, or clears the cell if the digit is there already. */
    function fillOrClear(digit: number): void {
        const cell = puzzle().selection[0];
        if (puzzle().digitAt(cell) === digit) puzzle().clearCell(cell);
        else puzzle().fillCell(cell, digit);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The line of help, for what is going on. */
function writeHint(state: { isSolved: boolean; selected: number; isFilled: boolean; canNote: boolean }): string {
    if (state.isSolved) return 'Solved! It\'s ticked off on the calendar.';
    if (state.selected === 0) return 'Tap a cell for notes, or drag across cells to link them.';
    if (state.isFilled) return 'Hold another digit to change it, or its own to clear it.';
    if (state.selected === 1) return 'Tap digits to pencil them in. Press and hold one to fill it in.';
    if (!state.canNote) return 'Linked cells must share a row, a column or a box.';
    return `Note the digits these ${state.selected} cells hold between them.`;
}
