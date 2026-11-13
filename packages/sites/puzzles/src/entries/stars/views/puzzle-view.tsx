/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import { ButtonView, DIM_TEXT_COLOR, INK_COLOR, LABEL_STYLE, LEVEL_NAMES, MARGIN, SMALL_STYLE, SOLVED_COLOR, writeDate } from '../../../shared';
import type { CellMark, GameModel, PuzzleModel } from '../models';
import { BoardView } from './board-view';
import { createStrokeViewModel } from './stroke-view-model';
import {
    BACK_WIDTH, BAR_BUTTON_HEIGHT, BAR_Y, BOARD_HEIGHT, BOARD_WIDTH, BOARD_X, BOARD_Y, BUTTON_GAP, BUTTON_HEIGHT, BUTTON_WIDTH, BUTTON_Y, HINT_Y,
    SCREEN_WIDTH,
} from './view-constants';

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
 * level, the grid, and buttons for undo and how to play. A line of help
 * along the bottom says how to mark cells, and that the puzzle is solved
 * once it is. The practice puzzle of a walkthrough says so in place of its
 * date.
 *
 * A tap moves a cell on from nothing, to a dot, to a star, and back to
 * nothing. A drag dots the empty cells it goes over, or rubs dots out if it
 * starts on one.
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
    const hintText = createComputed({ watch: isSolved, compute: writeHint });
    // What a drag does to the cells it goes over
    const stroke = createStrokeViewModel({
        markAt: (cell) => puzzle().markAt(cell),
        onStrokeStarted: () => puzzle().startStroke(),
        onCellMarked: (cell, mark) => puzzle().mark(cell, mark),
        onStrokeFinished: () => puzzle().finishStroke(),
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
            <container x={BOARD_X} y={BOARD_Y}>
                <BoardView
                    puzzle={() => puzzle().puzzle}
                    width={BOARD_WIDTH}
                    height={BOARD_HEIGHT}
                    markAt={(cell) => puzzle().markAt(cell)}
                    isClashAt={(cell) => puzzle().isClashAt(cell)}
                    isSolved={isSolved}
                    changes={() => puzzle().changes}
                    puzzlesOpened={() => model.puzzlesOpened}
                    onCellTapped={(cell) => puzzle().mark(cell, NEXT_MARKS[puzzle().markAt(cell)])}
                    onDragStarted={stroke.start}
                    onDraggedOver={stroke.markOver}
                    onDragFinished={stroke.finish}
                />
            </container>
            <ButtonView
                x={MARGIN}
                y={BUTTON_Y}
                width={BUTTON_WIDTH}
                height={BUTTON_HEIGHT}
                label="Undo"
                isEnabled={() => !isSolved() && puzzle().undoCount > 0}
                onPressed={() => puzzle().undo()}
            />
            <ButtonView
                x={MARGIN + BUTTON_WIDTH + BUTTON_GAP}
                y={BUTTON_Y}
                width={BUTTON_WIDTH}
                height={BUTTON_HEIGHT}
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
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** What a tap turns each mark into: dots first, since they come first in solving. */
const NEXT_MARKS: Readonly<Record<CellMark, CellMark>> = { none: 'dot', dot: 'star', star: 'none' };

/** The line of help, for what is going on. */
function writeHint(isSolved: boolean): string {
    if (isSolved) return 'Solved! It\'s ticked off on the calendar.';
    return 'Tap for a dot, again for a star. Drag to dot many cells.';
}
