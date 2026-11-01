/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import { findWeekday, type PuzzleModel, type SudokuModel, toCalendarDate, TUTORIAL_STEPS } from '../models';
import { BoardView } from './board-view';
import { ButtonView } from './button-view';
import { KeypadView } from './keypad-view';
import { PickerView } from './picker-view';
import { TutorialPointerView } from './tutorial-pointer-view';
import { TutorialView } from './tutorial-view';
import {
    BACK_WIDTH, BAR_BUTTON_HEIGHT, BAR_Y, DIM_TEXT_COLOR, GRID_X, GRID_Y, HINT_Y, INK_COLOR, KEYPAD_Y, LABEL_STYLE, LEVEL_NAMES,
    MARGIN, MONTH_NAMES, SCREEN_WIDTH, SMALL_STYLE, SOLVED_COLOR, TOOL_GAP, TOOL_HEIGHT, TOOL_WIDTH, TOOL_Y, WEEKDAY_NAMES,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PuzzleViewBindings {
    /** The game, which has a puzzle open whenever this view shows. */
    model: SudokuModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The puzzle's screen: the way back to the calendar, the puzzle's date and
 * level, the grid, a keypad for noting digits in the cells selected, undo,
 * and a way to play the tutorial again. A line of help along the bottom
 * says what to do next, and that the puzzle is solved once it is. While the
 * tutorial plays, its card covers the top, and an arrow shows what it means.
 */
export function PuzzleView(bindings: PuzzleViewBindings): Container {
    const { model } = bindings;
    // The view shows only while a puzzle is open, so its bindings never run without one
    const puzzle = (): PuzzleModel => model.puzzle!;
    const dateText = createComputed({ watch: () => model.puzzleDay, compute: writeDate });
    const levelText = createComputed({ watch: () => model.level, compute: (level) => `${LEVEL_NAMES[level]} puzzle` });
    const isSolved = (): boolean => puzzle().isSolved;
    const hintText = createComputed({
        watch: {
            isSolved,
            selected: () => puzzle().selection.length,
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
                    pickerCell={() => puzzle().pickerCell}
                    isSolved={isSolved}
                    changes={() => puzzle().changes}
                    onCellDoubleTapped={(cell) => puzzle().openPicker(cell)}
                />
            </container>
            <container x={GRID_X} y={KEYPAD_Y}>
                <KeypadView
                    digits={() => puzzle().selectionDigits}
                    isEnabled={() => puzzle().canNoteSelection}
                    canFill={() => puzzle().selection.length === 1}
                    changes={() => puzzle().changes}
                    onPressed={(digit) => puzzle().toggleNote(digit)}
                    onDoubleTapped={(digit) => puzzle().fillCell(puzzle().selection[0], digit)}
                    onTapTakenBack={() => puzzle().undo()}
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
                label="How to make notes"
                isEnabled={() => model.tutorial === undefined}
                onPressed={model.startTutorial}
            />
            <text
                text={hintText}
                x={SCREEN_WIDTH / 2}
                y={HINT_Y}
                anchor={0.5}
                style={SMALL_STYLE}
                tint={() => (isSolved() ? SOLVED_COLOR : DIM_TEXT_COLOR)}
            />
            <PickerView
                cell={() => puzzle().pickerCell}
                digit={() => (puzzle().pickerCell < 0 ? 0 : puzzle().digitAt(puzzle().pickerCell))}
                onChosen={(digit) => puzzle().fillIn(digit)}
                onClosed={() => puzzle().closePicker()}
            />
            <TutorialPointerView
                demo={() => model.tutorial?.demo ?? 'none'}
                demoCells={() => model.tutorial?.demoCells ?? NONE}
                demoDigits={() => model.tutorial?.demoDigits ?? NONE}
                demosShown={() => model.tutorial?.demosShown ?? 0}
            />
            <TutorialView
                step={() => model.tutorial?.step}
                stepNumber={() => model.tutorial?.stepNumber ?? 1}
                stepCount={TUTORIAL_STEPS.length}
                fillDigit={() => model.tutorial?.demoDigits[0] ?? 0}
                onEnded={model.endTutorial}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** No cells, or no digits, while the tutorial isn't playing. */
const NONE: readonly number[] = [];

/** The line of help, for what is going on. */
function writeHint(state: { isSolved: boolean; selected: number; canNote: boolean }): string {
    if (state.isSolved) return 'Solved! It\'s ticked off on the calendar.';
    if (state.selected === 0) return 'Tap a cell for notes, or drag across cells to link them.';
    if (state.selected === 1) return 'Tap digits to pencil them in. Double-tap one to fill it in.';
    if (!state.canNote) return 'Linked cells must share a row, a column or a box.';
    return `Note the digits these ${state.selected} cells hold between them.`;
}

/** The date of `day`, written out in full, such as "Friday 30 October 2026". */
function writeDate(day: number): string {
    const { year, month, day: dayOfMonth } = toCalendarDate(day);
    return `${WEEKDAY_NAMES[findWeekday(day)]} ${dayOfMonth} ${MONTH_NAMES[month - 1]} ${year}`;
}
