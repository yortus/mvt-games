import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateView } from '@mvtjs/pixi';
import { createGameModel } from '../models';
import { GameView } from './game-view';

/** Any step with time in it reaches the first bubble, whose wait starts at 0. */
const STEP_MS = 16;

describe('GameView', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('lets out a bubble only once time has passed', () => {
        const view = GameView({ model: createGameModel() });
        // A bubble takes one random number, for where it starts
        const random = vi.spyOn(Math, 'random');

        updateView(view, 0);
        updateView(view, 0);
        expect(random).not.toHaveBeenCalled();

        updateView(view, STEP_MS);
        expect(random).toHaveBeenCalledTimes(1);
    });
});
