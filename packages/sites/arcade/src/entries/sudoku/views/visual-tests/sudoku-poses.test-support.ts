import { Container, Graphics } from 'pixi.js';
import { advanceTime, refreshView } from '@mvtjs/pixi';
import { createMemoryStore } from '../../../../storage';
import { loadSudokuGenerator } from '#sudoku-digger';
import { createSudokuModel, findPuzzleSeed, playShowcase, type SudokuModel, toDayNumber } from '../../models';
import { PAPER_COLOR, SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';

/** Today, in every pose: Friday 30 October 2026. */
export const TODAY = toDayNumber({ year: 2026, month: 10, day: 30 });

const generate = await loadSudokuGenerator();

/** Something done in a game, to bring it into the state a pose shows. */
export type Play = (model: SudokuModel) => void;

/**
 * Returns the view `makeView` makes of a new game on `TODAY`, on paper,
 * after `play` has played in it and `ms` has passed. A list of plays has a
 * frame pass after each, refreshed as on screen, so the view sees each of
 * them.
 */
export async function poseGame(makeView: (model: SudokuModel) => Container, play: Play | readonly Play[], ms = 16): Promise<Container> {
    const model = createSudokuModel({ today: TODAY, store: createMemoryStore(), generate, offersTutorial: false });
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(PAPER_COLOR), makeView(model));
    await advanceTime(16, model, view);
    const plays = typeof play === 'function' ? [play] : play;
    for (let i = 0; i < plays.length; i++) {
        if (i > 0) {
            await advanceTime(16, model, view);
            refreshView(view);
        }
        plays[i](model);
    }
    await advanceTime(ms, model, view);
    return view;
}

/** Fills in every empty cell of the open puzzle with its solution's digit. */
export function solve(model: SudokuModel): void {
    const { solution } = generate({ seed: findPuzzleSeed(model.puzzleDay, model.level), level: model.level });
    for (let cell = 0; cell < solution.length; cell++) {
        if (model.puzzle?.digitAt(cell) !== 0) continue;
        model.puzzle.openPicker(cell);
        model.puzzle.fillIn(solution[cell]);
    }
}

/** Plays some of today's puzzle, as the thumbnail shows it. */
export function playSome(model: SudokuModel): void {
    playShowcase({ model, generate });
}

/** The first cell from `from` on that is empty and has no pencil marks, or -1. */
export function findEmptyCell(model: SudokuModel, from: number): number {
    for (let cell = from; cell < 81; cell++) {
        if (model.puzzle?.digitAt(cell) === 0 && model.puzzle.marksAt(cell) === 0) return cell;
    }
    return -1;
}
