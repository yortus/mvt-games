/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { Match, Switch } from '@mvtjs/pixi';
import type { SfxChip } from '#shared';
import type { SudokuModel } from '../models';
import { CalendarView } from './calendar-view';
import { PuzzleView } from './puzzle-view';
import { SudokuAudioView } from './sudoku-audio-view';
import { PAPER_COLOR, SCREEN_HEIGHT, SCREEN_WIDTH } from './view-constants';

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

/** The whole screen, on paper: the calendar of days to choose from, or the puzzle being played. */
export function SudokuView(bindings: SudokuViewBindings): Container {
    const { model, sfx } = bindings;
    return (
        <container>
            <graphics ref={(g) => g.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(PAPER_COLOR)} />
            <Switch>
                <Match when={() => model.phase === 'calendar'}>
                    <CalendarView model={model} />
                </Match>
                <Match when={() => model.puzzle !== undefined}>
                    {() => <PuzzleView model={model} />}
                </Match>
            </Switch>
            <SudokuAudioView
                sfx={sfx}
                pickerCell={() => model.puzzle?.pickerCell ?? -1}
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
