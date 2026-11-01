import { Container, Graphics } from 'pixi.js';
import { advanceTime, refreshView } from '@mvtjs/pixi';
import { createMemoryStore } from '@mvtjs/site-kit/storage';
import { PAPER_COLOR, toDayNumber } from '../../../../shared';
import { createMinotaurModel, type MinotaurModel, PASSAGE, playShowcase } from '../../models';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';

/** Today, in every pose: Friday 30 October 2026. */
export const TODAY = toDayNumber({ year: 2026, month: 10, day: 30 });

/** Something done in a game, to bring it into the state a pose shows. */
export type Play = (model: MinotaurModel) => void;

/**
 * Returns the view `makeView` makes of a new game on `TODAY`, on paper,
 * after `play` has played in it and `ms` has passed. A list of plays has a
 * frame pass after each, refreshed as on screen, so the view sees each of
 * them.
 */
export async function poseGame(makeView: (model: MinotaurModel) => Container, play: Play | readonly Play[], ms = 16): Promise<Container> {
    const model = createMinotaurModel({ today: TODAY, store: createMemoryStore(), offersIntro: false });
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

/** Marks every passage of the open puzzle's solution, in one stroke. */
export function solve(model: MinotaurModel): void {
    const puzzle = model.puzzle!;
    const { solution } = puzzle.maze;
    puzzle.startStroke();
    for (let edge = 0; edge < solution.length; edge++) {
        if (solution[edge] === PASSAGE) puzzle.mark(edge, 'passage');
    }
    puzzle.finishStroke();
}

/** Plays some of today's medium puzzle, as the thumbnail shows it. */
export function playSome(model: MinotaurModel): void {
    playShowcase(model);
}
