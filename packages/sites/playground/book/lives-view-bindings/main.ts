import { definePixiProject } from 'playground';
import { createGameModel } from './models';
import { GameView } from './views';

// The project: a model of a game for two players, and a view of their lives
// on the stage. The playground ticks what `start` returns, then updates and
// refreshes the views.
export const project = definePixiProject({
    width: 640,
    height: 300,
    background: 0x10141f,
    start: ({ stage }) => {
        const model = createGameModel();
        stage.addChild(GameView({ model }));
        return model;
    },
});
