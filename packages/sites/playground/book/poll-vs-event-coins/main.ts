import { definePixiProject } from 'playground';
import { createPlayerModel } from './models';
import { GameView } from './views';

const WIDTH = 640;
const HEIGHT = 360;

// The project: a player's coins and lives, and two HUDs of them. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0f1428,
    start: ({ stage }) => {
        const model = createPlayerModel();
        stage.addChild(GameView({ model, width: WIDTH, height: HEIGHT }));
        return model;
    },
});
