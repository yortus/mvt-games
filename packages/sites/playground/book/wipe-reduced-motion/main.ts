import { definePixiProject } from 'playground';
import { createLevelModel } from './models';
import { GameView } from './views';

const WIDTH = 640;
const HEIGHT = 360;

// The project: a game of levels, and a view of it on the stage. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x111827,
    start: ({ stage }) => {
        const model = createLevelModel();
        stage.addChild(GameView({ model, width: WIDTH, height: HEIGHT }));
        return model;
    },
});
