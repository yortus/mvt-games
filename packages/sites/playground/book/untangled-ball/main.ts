import { definePixiProject } from 'playground';
import { createBallModel } from './models';
import { BallView, HeightView } from './views';

const WIDTH = 400;
const HEIGHT = 300;

// The bouncing ball, with its three jobs apart. The model decides where the
// ball is. BallView draws it, and times its own flash. HeightView reads the
// same model, to show the height as a number. The playground is the ticker:
// every frame, it ticks the model, then the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0a1628,
    start: ({ stage }) => {
        const model = createBallModel({ width: WIDTH, height: HEIGHT });

        const height = HeightView({ height: () => HEIGHT - model.radius - model.y });
        height.position.set(12, 10);

        stage.addChild(BallView({ model }), height);
        return model;
    },
});
