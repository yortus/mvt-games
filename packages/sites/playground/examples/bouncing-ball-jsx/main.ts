import { definePixiProject } from 'playground';
import { createBallModel } from './models';
import { BallView } from './views';

const WIDTH = 400;
const HEIGHT = 300;

// The project: a model of the ball, and a view of it on the stage. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0a1628,
    start: ({ stage }) => {
        const model = createBallModel({ width: WIDTH, height: HEIGHT });
        stage.addChild(BallView({ model, width: WIDTH, height: HEIGHT }));
        return model;
    },
});
