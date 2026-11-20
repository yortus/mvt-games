/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import { ButtonView, DIM_TEXT_COLOR, INK_COLOR, LABEL_STYLE, LEVEL_NAMES, MARGIN, SMALL_STYLE, SOLVED_COLOR, writeDate } from '../../../shared';
import type { GameModel, PuzzleModel } from '../models';
import { BoardView } from './board-view';
import { createStrokeViewModel } from './stroke-view-model';
import {
    BACK_WIDTH, BAR_BUTTON_HEIGHT, BAR_Y, BOARD_HEIGHT, BOARD_WIDTH, BOARD_X, BOARD_Y, BUTTON_HEIGHT, BUTTON_WIDTH, BUTTON_Y, HINT_Y, HOW_TO_PLAY_X,
    SCREEN_WIDTH, UNDO_X,
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
 * level, the valley, and buttons for undo and how to play. A line of help
 * along the bottom says how to draw, and that the puzzle is solved once it
 * is. The practice puzzle of a walkthrough says so in place of its date.
 *
 * A drag from cell to cell draws the river between them, or rubs it out if
 * the first edge it crosses has river already. A tap plants a flower on a
 * cell, the player's note that the river keeps away, or removes it.
 */
export function PuzzleView(bindings: PuzzleViewBindings): Container {
    const { model } = bindings;
    // The view shows only while a puzzle is open, so its bindings never run without one
    const puzzle = (): PuzzleModel => model.puzzle!;
    const isPractice = (): boolean => model.intro.practice !== undefined;
    const dateText = createComputed({
        watch: { day: () => model.puzzleDay, isPractice },
        compute: ({ day, isPractice: practising }) => (practising ? 'Practice valley' : writeDate(day)),
    });
    const levelText = createComputed({
        watch: { level: () => model.puzzleLevel, isPractice },
        compute: ({ level, isPractice: practising }) => (practising ? 'Nothing here is kept' : `${LEVEL_NAMES[level]} valley`),
    });
    const isSolved = (): boolean => puzzle().isSolved;
    const hintText = createComputed({ watch: isSolved, compute: writeHint });
    // What a drag does to the edges it goes over
    const stroke = createStrokeViewModel({
        isRiverAt: (edge) => puzzle().isRiverAt(edge),
        isEdgeFixedAt: (edge) => puzzle().isEdgeFixedAt(edge),
        onStrokeStarted: () => puzzle().startStroke(),
        onRiverSet: (edge, isRiver) => puzzle().setRiver(edge, isRiver),
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
                    isRiverAt={(edge) => puzzle().isRiverAt(edge)}
                    isMeadowAt={(cell) => puzzle().isMeadowAt(cell)}
                    isGivenAt={(cell) => puzzle().isGivenAt(cell)}
                    isClashAt={(cell) => puzzle().isClashAt(cell)}
                    clueStateAt={(line) => puzzle().clueStateAt(line)}
                    isSolved={isSolved}
                    changes={() => puzzle().changes}
                    puzzlesOpened={() => model.puzzlesOpened}
                    onCellTapped={(cell) => puzzle().setMeadow(cell, !puzzle().isMeadowAt(cell))}
                    onDraggedOver={stroke.markOver}
                    onDragFinished={stroke.finish}
                />
            </container>
            <ButtonView
                x={UNDO_X}
                y={BUTTON_Y}
                width={BUTTON_WIDTH}
                height={BUTTON_HEIGHT}
                label="Undo"
                isEnabled={() => !isSolved() && puzzle().undoCount > 0}
                onPressed={() => puzzle().undo()}
            />
            <ButtonView
                x={HOW_TO_PLAY_X}
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

/** The line of help, for what is going on. */
function writeHint(isSolved: boolean): string {
    if (isSolved) return 'The river reaches the sea! It\'s ticked off on the calendar.';
    return 'Drag from cell to cell to draw the river. Tap to plant a flower.';
}
