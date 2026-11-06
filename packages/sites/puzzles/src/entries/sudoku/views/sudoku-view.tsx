/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { Match, Switch } from '@mvtjs/pixi';
import type { SfxChip } from '@mvtjs/site-kit/shared';
import { CalendarView, IntroView, LEVEL_NAMES, PAPER_COLOR, type ScreenPoint } from '../../../shared';
import type { SudokuModel, SudokuTarget } from '../models';
import { HOW_TO_PLAY } from '../start';
import { ExampleGridView } from './example-grid-view';
import { findCellMiddleX, findCellMiddleY, findKeyMiddleX, KEY_MIDDLE_Y } from './puzzle-layout';
import { PuzzleView } from './puzzle-view';
import { SudokuAudioView } from './sudoku-audio-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SudokuViewBindings {
    model: SudokuModel;
    /** The chip the sound effects play on. */
    sfx: SfxChip<'audio90'>;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole screen, on paper: the calendar of days to choose from, or the
 * puzzle being played. Over either goes the way in: the card that says how
 * to play, or the walkthrough's card and its arrow, over the puzzle's screen.
 */
export function SudokuView(bindings: SudokuViewBindings): Container {
    const { model, sfx } = bindings;
    return (
        <container>
            <graphics ref={(g) => g.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(PAPER_COLOR)} />
            <Switch>
                <Match when={() => model.phase === 'calendar'}>
                    <CalendarView
                        calendar={model.calendar}
                        title="Sudoku"
                        tagline="A new puzzle every day, at four levels"
                        levelNames={LEVEL_NAMES}
                        onDayChosen={model.openPuzzle}
                    />
                </Match>
                <Match when={() => model.puzzle !== undefined}>
                    {() => <PuzzleView model={model} />}
                </Match>
            </Switch>
            <IntroView intro={model.intro} example={<ExampleGridView example={model.example} />} text={HOW_TO_PLAY} findPoint={findTargetPoint} />
            <SudokuAudioView
                sfx={sfx}
                answersPlaced={() => model.puzzle?.answersPlaced ?? 0}
                clashesMade={() => model.puzzle?.clashesMade ?? 0}
                filledCell={() => model.puzzle?.lastFilledCell ?? -1}
                filledDigit={() => {
                    const cell = model.puzzle?.lastFilledCell ?? -1;
                    return cell < 0 ? 0 : model.puzzle?.digitAt(cell) ?? 0;
                }}
                undosDone={() => model.puzzle?.undosDone ?? 0}
                puzzlesSolved={() => model.puzzlesSolved}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where the walkthrough's arrow touches a target, on the puzzle's screen: the middle of a cell, or of a digit's key. */
function findTargetPoint(target: SudokuTarget): ScreenPoint {
    if (target.on === 'cell') return { x: findCellMiddleX(target.cell), y: findCellMiddleY(target.cell) };
    return { x: findKeyMiddleX(target.digit), y: KEY_MIDDLE_Y };
}
