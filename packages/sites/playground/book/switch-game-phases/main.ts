import { definePixiProject } from 'playground';
import { createGameModel } from './models';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from './views';

// The project: a model of the game, and its screen. The playground ticks
// what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    background: 0x101830,
    start: ({ stage }) => {
        const model = createGameModel({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
        stage.addChild(GameView({ model }));
        return model;
    },
});
