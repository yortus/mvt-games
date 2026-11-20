/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { Match, Switch } from '@mvtjs/pixi';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import { CalendarView, IntroView, LEVEL_NAMES, PAPER_COLOR, type ScreenPoint } from '../../../shared';
import type { GameModel, BoatsTarget } from '../models';
import { HOW_TO_PLAY } from '../start';
import { AudioView } from './audio-view';
import { layOutBoard } from './board-layout';
import { ExampleHarbourView } from './example-harbour-view';
import { PuzzleView } from './puzzle-view';
import { BOARD_HEIGHT, BOARD_WIDTH, BOARD_X, BOARD_Y, BUTTON_HEIGHT, BUTTON_WIDTH, BUTTON_Y, SCREEN_HEIGHT, SCREEN_WIDTH, UNDO_X } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the game's screen shows, and what it plays its sounds on. */
export interface GameViewBindings {
    /** The game, read once. */
    model: GameModel;
    /** The chip the sound effects play on. */
    sfx: SfxChip<'audio90'>;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole screen, on paper. It shows the calendar of days to choose from,
 * or the harbour being solved. The way in goes over either one. That's the
 * card that says how to play, or the walkthrough's card and its arrow over
 * the puzzle's screen.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model, sfx } = bindings;

    /**
     * Returns where the walkthrough's arrow touches a target on the puzzle's
     * screen. That's a point on the harbour, laid out as the board lays it
     * out, or the middle of the Undo button.
     */
    const findTargetPoint = (target: BoatsTarget): ScreenPoint => {
        if (target.on === 'undo') return { x: UNDO_X + BUTTON_WIDTH / 2, y: BUTTON_Y + BUTTON_HEIGHT / 2 };
        const { cellSize, gridX, gridY } = layOutBoard({ puzzle: model.puzzle!.puzzle, hasFleet: true, width: BOARD_WIDTH, height: BOARD_HEIGHT });
        return { x: BOARD_X + gridX + target.x * cellSize, y: BOARD_Y + gridY + target.y * cellSize };
    };
    return (
        <container>
            <graphics ref={(g) => g.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(PAPER_COLOR)} />
            <Switch>
                <Match when={() => model.phase === 'calendar'}>
                    <CalendarView
                        calendar={model.calendar}
                        title="Boats"
                        tagline="A new harbour of boats to moor every day"
                        levelNames={LEVEL_NAMES}
                        onDayChosen={model.openPuzzle}
                        onHowToPlayPressed={model.intro.showCard}
                    />
                </Match>
                <Match when={() => model.puzzle !== undefined}>
                    {() => <PuzzleView model={model} />}
                </Match>
            </Switch>
            <IntroView intro={model.intro} example={<ExampleHarbourView example={model.example} />} text={HOW_TO_PLAY} findPoint={findTargetPoint} />
            <AudioView
                sfx={sfx}
                boatsMarked={() => model.puzzle?.boatsMarked ?? 0}
                waterMarked={() => model.puzzle?.waterMarked ?? 0}
                marksCleared={() => model.puzzle?.marksCleared ?? 0}
                clashesMade={() => model.puzzle?.clashesMade ?? 0}
                boatsFinished={() => model.puzzle?.boatsFinished ?? 0}
                undosDone={() => model.puzzle?.undosDone ?? 0}
                markPan={() => findMarkPan(model)}
                puzzlesOpened={() => model.puzzlesOpened}
                puzzlesSolved={() => model.puzzlesSolved}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where across the harbour the last mark was, from -1 at the left edge to 1 at the right. */
function findMarkPan(model: GameModel): number {
    const puzzle = model.puzzle;
    if (puzzle === undefined || puzzle.lastMarkedCell < 0) return 0;
    const { size } = puzzle.puzzle.grid;
    return (((puzzle.lastMarkedCell % size) + 0.5) / size) * 2 - 1;
}
