import { Graphics } from 'pixi.js';
import { definePixiProject } from 'playground';
import { createBallModel } from './models';
import { BallView, HeightView } from './views';

/** The size of the ball's box, in world units. */
const BOX_WIDTH = 400;
const BOX_HEIGHT = 300;

// One model, and three views of it. The first BallView draws the box at one
// pixel per world unit. The second is the same view, drawn at half the size.
// HeightView shows the ball's height as a number. None of them changes the
// model, and all three read it on the same frame, so they always agree.
export const project = definePixiProject({
    width: 640,
    height: 300,
    background: 0x0a1628,
    start: ({ stage }) => {
        const model = createBallModel({ width: BOX_WIDTH, height: BOX_HEIGHT });

        const ball = BallView({ model });

        const smallBall = BallView({ model });
        smallBall.scale.set(0.5);
        smallBall.position.set(430, 30);

        const height = HeightView({ height: () => BOX_HEIGHT - model.radius - model.y });
        height.position.set(430, 200);

        // Lines that show where each box ends
        const frames = new Graphics()
            .moveTo(BOX_WIDTH, 0).lineTo(BOX_WIDTH, BOX_HEIGHT).stroke({ color: 0x33445e, width: 2 })
            .rect(430, 30, BOX_WIDTH / 2, BOX_HEIGHT / 2).stroke({ color: 0x33445e, width: 1 });

        stage.addChild(frames, ball, smallBall, height);
        return model;
    },
});
