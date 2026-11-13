/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import { ButtonView, DIM_TEXT_COLOR, INK_COLOR, LABEL_STYLE, LEVEL_NAMES, MARGIN, SMALL_STYLE, SOLVED_COLOR, writeDate } from '../../../shared';
import type { GameModel, PuzzleModel } from '../models';
import { BoardView } from './board-view';
import {
    BACK_WIDTH, BAR_BUTTON_HEIGHT, BAR_Y, BOARD_HEIGHT, BOARD_WIDTH, BOARD_X, BOARD_Y, BUTTON_GAP, BUTTON_HEIGHT, BUTTON_WIDTH, BUTTON_Y, HINT_Y,
    SCREEN_WIDTH, STATUS_Y,
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
 * level, the picture, a count of the swaps, and buttons for undo and how to
 * play. A line of help along the bottom says how to swap, and that the
 * picture is whole once it is. The practice picture of a walkthrough says
 * so in place of its date.
 */
export function PuzzleView(bindings: PuzzleViewBindings): Container {
    const { model } = bindings;
    // The view shows only while a puzzle is open, so its bindings never run without one
    const puzzle = (): PuzzleModel => model.puzzle!;
    const isPractice = (): boolean => model.intro.practice !== undefined;
    const dateText = createComputed({
        watch: { day: () => model.puzzleDay, isPractice },
        compute: ({ day, isPractice: practising }) => (practising ? 'Practice window' : writeDate(day)),
    });
    const levelText = createComputed({
        watch: { level: () => model.puzzleLevel, isPractice },
        compute: ({ level, isPractice: practising }) => (practising ? 'Nothing here is kept' : `${LEVEL_NAMES[level]} window`),
    });
    const isSolved = (): boolean => puzzle().isSolved;
    const statusText = createComputed({
        watch: { swaps: () => puzzle().swapCount, isSolved, fewest: () => puzzle().puzzle.fewestSwaps },
        compute: ({ swaps, isSolved: solved, fewest }) => writeStatus(swaps, solved, fewest),
    });
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
                    puzzle={() => puzzle().puzzle}
                    width={BOARD_WIDTH}
                    height={BOARD_HEIGHT}
                    pieceAt={(tile) => puzzle().pieceAt(tile)}
                    isLockedAt={(tile) => puzzle().isLockedAt(tile)}
                    isSolved={isSolved}
                    lastSwappedTile={() => puzzle().lastTileB}
                    changes={() => puzzle().changes}
                    puzzlesOpened={() => model.puzzlesOpened}
                    canSwap={(a, b) => puzzle().canSwap(a, b)}
                    onSwapRequested={(a, b) => puzzle().swap(a, b)}
                />
            </container>
            <text
                text={statusText}
                x={SCREEN_WIDTH / 2}
                y={STATUS_Y}
                anchor={0.5}
                style={SMALL_STYLE}
                tint={() => (isSolved() ? SOLVED_COLOR : INK_COLOR)}
            />
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
            <text text={hintText} x={SCREEN_WIDTH / 2} y={HINT_Y} anchor={0.5} style={SMALL_STYLE} tint={DIM_TEXT_COLOR} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The count of swaps, and once solved, the fewest that would have done. */
function writeStatus(swaps: number, isSolved: boolean, fewest: number): string {
    if (isSolved) return `Whole again in ${swaps} ${swaps === 1 ? 'swap' : 'swaps'}. The fewest possible: ${fewest}.`;
    return `${swaps} ${swaps === 1 ? 'swap' : 'swaps'}`;
}

/** The line of help, for what is going on. */
function writeHint(isSolved: boolean): string {
    if (isSolved) return 'It\'s ticked off on the calendar.';
    return 'Drag a piece onto another of its shape, or tap two, to swap them.';
}
