import { definePixiProject } from 'playground';
import { createShipModel } from './models';
import { GameView } from './views';

const WIDTH = 640;
const HEIGHT = 300;

// The project: a model of a ship that fires, and a view of it on the stage,
// which plays its shots on the playground's sound chip. The playground ticks
// what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x10141f,
    start: ({ stage, sound }) => {
        const model = createShipModel({ x: 110, y: HEIGHT - 40 });
        stage.addChild(GameView({ model, sfx: sound, width: WIDTH, height: HEIGHT }));
        return model;
    },
});
