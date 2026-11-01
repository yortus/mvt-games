import { definePixiProject } from 'playground';
import { createBallModel } from './models';
import { BallView } from './views';

// The project: a model of the ball, and a view of it on the stage. Here you
// don't write the loop. The playground calls `start` once, then every frame
// it ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: 400,
    height: 300,
    background: 0x0a1628,
    start: ({ stage }) => {
        const model = createBallModel({ width: 400, height: 300 });
        stage.addChild(BallView({ model }));
        return model;
    },
});
