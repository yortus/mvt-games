/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import { ButtonView, DIM_TEXT_COLOR, INK_COLOR, LABEL_STYLE, LEVEL_NAMES, MARGIN, SMALL_STYLE, SOLVED_COLOR, writeDate } from '../../../shared';
import type { GameModel, PuzzleModel } from '../models';
import { BoardView } from './board-view';
import {
    BACK_WIDTH, BAR_BUTTON_HEIGHT, BAR_Y, BOARD_HEIGHT, BOARD_WIDTH, BOARD_X, BOARD_Y, HINT_Y, SCREEN_WIDTH, BUTTON_GAP, BUTTON_HEIGHT,
    BUTTON_WIDTH, BUTTON_Y,
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
 * level, the maze, and buttons for undo and how to play. A line of help
 * along the bottom says how to draw, and that the maze is built once it is.
 * The practice maze of a walkthrough says so in place of its date.
 */
export function PuzzleView(bindings: PuzzleViewBindings): Container {
    const { model } = bindings;
    // The view shows only while a puzzle is open, so its bindings never run without one
    const puzzle = (): PuzzleModel => model.puzzle!;
    const isPractice = (): boolean => model.intro.practice !== undefined;
    const dateText = createComputed({
        watch: { day: () => model.puzzleDay, isPractice },
        compute: ({ day, isPractice: practising }) => (practising ? 'Practice maze' : writeDate(day)),
    });
    const levelText = createComputed({
        watch: { level: () => model.puzzleLevel, isPractice },
        compute: ({ level, isPractice: practising }) => (practising ? 'Nothing here is kept' : `${LEVEL_NAMES[level]} maze`),
    });
    const isSolved = (): boolean => puzzle().isSolved;
    const hintText = createComputed({ watch: isSolved, compute: writeHint });

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
                    maze={() => puzzle().maze}
                    width={BOARD_WIDTH}
                    height={BOARD_HEIGHT}
                    markAt={(edge) => puzzle().markAt(edge)}
                    isClashAt={(cell) => puzzle().isClashAt(cell)}
                    clueStateAt={(line) => puzzle().clueStateAt(line)}
                    isSolved={isSolved}
                    changes={() => puzzle().changes}
                    onStrokeStarted={() => puzzle().startStroke()}
                    onEdgeMarked={(edge, mark) => puzzle().mark(edge, mark)}
                    onStrokeFinished={() => puzzle().finishStroke()}
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

/** The line of help, for what is going on. */
function writeHint(isSolved: boolean): string {
    if (isSolved) return 'Built! It\'s ticked off on the calendar.';
    return 'Drag through cells for the path, along lines for walls. Drag again to rub out.';
}
