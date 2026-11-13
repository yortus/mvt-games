import { Container, Graphics } from 'pixi.js';
import { advanceTime } from '@mvtjs/pixi';
import { createMemoryStore } from '@mvtjs/site-kit/storage';
import { PAPER_COLOR, toDayNumber } from '../../../../shared';
import { createGameModel, type GameModel, STAR } from '../../models';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';

/** Today, in every pose: Friday 30 October 2026. */
export const TODAY = toDayNumber({ year: 2026, month: 10, day: 30 });

/** Something done in a game, to bring it into the state a pose shows. */
export type Play = (model: GameModel) => void;

/** Returns the view `makeView` makes of a new game on `TODAY`, on paper, after `play` has played in it and `ms` has passed. */
export async function poseGame(makeView: (model: GameModel) => Container, play: Play, ms = 16): Promise<Container> {
    const model = createGameModel({ today: TODAY, store: createMemoryStore(), offersIntro: false });
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(PAPER_COLOR), makeView(model));
    await advanceTime(16, model, view);
    play(model);
    await advanceTime(ms, model, view);
    return view;
}

/** Places every star of the open puzzle's solution. */
export function solve(model: GameModel): void {
    const puzzle = model.puzzle!;
    const { solution } = puzzle.puzzle;
    for (let cell = 0; cell < solution.length; cell++) {
        if (solution[cell] === STAR) puzzle.mark(cell, 'star');
    }
}
