/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { Match, Switch } from '@mvtjs/pixi';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import { CalendarView, IntroView, LEVEL_NAMES, MARGIN, PAPER_COLOR, type ScreenPoint } from '../../../shared';
import type { GameModel, MinotaurTarget } from '../models';
import { HOW_TO_PLAY } from '../start';
import { AudioView } from './audio-view';
import { layOutBoard } from './board-layout';
import { ExampleMazeView } from './example-maze-view';
import { PuzzleView } from './puzzle-view';
import {
    BOARD_HEIGHT, BOARD_WIDTH, BOARD_X, BOARD_Y, BUTTON_HEIGHT, BUTTON_WIDTH, BUTTON_Y, SCREEN_HEIGHT, SCREEN_WIDTH,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    model: GameModel;
    /** The chip the sound effects play on. */
    sfx: SfxChip<'audio90'>;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole screen, on paper: the calendar of days to choose from, or the
 * maze being built. Over either goes the way in: the card that says how to
 * play, or the walkthrough's card and its arrow, over the maze's screen.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model, sfx } = bindings;

    /** Where the walkthrough's arrow touches a target, on the maze's screen: a point on the maze, laid out as the board lays it out, or the middle of the Undo button. */
    const findTargetPoint = (target: MinotaurTarget): ScreenPoint => {
        if (target.on === 'undo') return { x: MARGIN + BUTTON_WIDTH / 2, y: BUTTON_Y + BUTTON_HEIGHT / 2 };
        const { grid, clues } = model.puzzle!.maze;
        const { cellSize, gridX, gridY } = layOutBoard({
            rows: grid.rows, cols: grid.cols, clues, columnLineCount: grid.columnLineCount, width: BOARD_WIDTH, height: BOARD_HEIGHT,
        });
        return { x: BOARD_X + gridX + target.x * cellSize, y: BOARD_Y + gridY + target.y * cellSize };
    };
    return (
        <container>
            <graphics ref={(g) => g.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(PAPER_COLOR)} />
            <Switch>
                <Match when={() => model.phase === 'calendar'}>
                    <CalendarView
                        calendar={model.calendar}
                        title="Minotaur"
                        tagline="A new maze to build every day, at four levels"
                        levelNames={LEVEL_NAMES}
                        onDayChosen={model.openPuzzle}
                    />
                </Match>
                <Match when={() => model.puzzle !== undefined}>
                    {() => <PuzzleView model={model} />}
                </Match>
            </Switch>
            <IntroView intro={model.intro} example={<ExampleMazeView example={model.example} />} text={HOW_TO_PLAY} findPoint={findTargetPoint} />
            <AudioView
                sfx={sfx}
                passagesMarked={() => model.puzzle?.passagesMarked ?? 0}
                wallsMarked={() => model.puzzle?.wallsMarked ?? 0}
                marksCleared={() => model.puzzle?.marksCleared ?? 0}
                clashesMade={() => model.puzzle?.clashesMade ?? 0}
                undosDone={() => model.puzzle?.undosDone ?? 0}
                strokePassages={() => model.puzzle?.strokePassages ?? 0}
                markPan={() => findMarkPan(model)}
                puzzlesSolved={() => model.puzzlesSolved}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where across the maze the last mark was, from -1 at the left edge to 1 at the right. */
function findMarkPan(model: GameModel): number {
    const puzzle = model.puzzle;
    if (puzzle === undefined || puzzle.lastMarkedEdge < 0) return 0;
    const { grid } = puzzle.maze;
    const edge = puzzle.lastMarkedEdge;
    // The middle of the edge, across the maze: on the line right of its first cell, or across the middle of that cell
    const col = (grid.edgeCellA[edge] % grid.cols) + (grid.isEdgeBetweenColumns(edge) ? 1 : 0.5);
    return (col / grid.cols) * 2 - 1;
}
