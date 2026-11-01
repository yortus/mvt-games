import { definePixiProject } from 'playground';
import { createShipModel } from './models';
import { GameView } from './views';

const WIDTH = 640;
const HEIGHT = 360;

// The project: a model of the ship, and a view of it on the stage. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0b1020,
    start: ({ stage }) => {
        const model = createShipModel({ width: WIDTH, height: HEIGHT });
        stage.addChild(GameView({ model, width: WIDTH, height: HEIGHT }));
        return model;
    },
});
