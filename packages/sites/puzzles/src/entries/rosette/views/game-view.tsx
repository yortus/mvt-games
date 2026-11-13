/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { Match, Switch } from '@mvtjs/pixi';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import { CalendarView, IntroView, LEVEL_NAMES, MARGIN, PAPER_COLOR, type ScreenPoint } from '../../../shared';
import type { GameModel, RosetteTarget } from '../models';
import { HOW_TO_PLAY } from '../start';
import { AudioView } from './audio-view';
import { ExamplePictureView } from './example-picture-view';
import { layOutPicture } from './picture-layout';
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
 * picture being put back together. Over either goes the way in: the card
 * that says how to play, or the walkthrough's card and its arrow, over the
 * picture's screen.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model, sfx } = bindings;

    /** Where the walkthrough's arrow touches a target, on the picture's screen: a tile's middle, laid out as the board lays it out, or the middle of the Undo button. */
    const findTargetPoint = (target: RosetteTarget): ScreenPoint => {
        if (target.on === 'undo') return { x: MARGIN + BUTTON_WIDTH / 2, y: BUTTON_Y + BUTTON_HEIGHT / 2 };
        const { patch } = model.puzzle!.puzzle;
        const { centreX, centreY, scale } = layOutPicture({ halfWidth: patch.halfWidth, halfHeight: patch.halfHeight, width: BOARD_WIDTH, height: BOARD_HEIGHT });
        return { x: BOARD_X + centreX + patch.middleXs[target.tile] * scale, y: BOARD_Y + centreY + patch.middleYs[target.tile] * scale };
    };
    return (
        <container>
            <graphics ref={(g) => g.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(PAPER_COLOR)} />
            <Switch>
                <Match when={() => model.phase === 'calendar'}>
                    <CalendarView
                        calendar={model.calendar}
                        title="Rosette"
                        tagline="A new window to mend every day, at four levels"
                        levelNames={LEVEL_NAMES}
                        onDayChosen={model.openPuzzle}
                    />
                </Match>
                <Match when={() => model.puzzle !== undefined}>
                    {() => <PuzzleView model={model} />}
                </Match>
            </Switch>
            <IntroView intro={model.intro} example={<ExamplePictureView example={model.example} />} text={HOW_TO_PLAY} findPoint={findTargetPoint} />
            <AudioView
                sfx={sfx}
                swapsMade={() => model.puzzle?.swapsMade ?? 0}
                undosDone={() => model.puzzle?.undosDone ?? 0}
                swapPan={() => findSwapPan(model)}
                locksGained={() => model.puzzle?.locksGained ?? 0}
                isSolved={() => model.puzzle?.isSolved ?? false}
                puzzlesSolved={() => model.puzzlesSolved}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where across the picture the last swap ended, from -1 at the left edge to 1 at the right. */
function findSwapPan(model: GameModel): number {
    const puzzle = model.puzzle;
    if (puzzle === undefined || puzzle.lastTileB < 0) return 0;
    const { patch } = puzzle.puzzle;
    return Math.max(-1, Math.min(1, patch.middleXs[puzzle.lastTileB] / patch.halfWidth));
}
