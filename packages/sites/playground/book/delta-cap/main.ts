import { definePixiProject } from 'playground';
import { createBallModel } from './models';
import { ButtonView, LaneView } from './views';

/**
 * The one big step the button gives, in ms: the step a ticker with no cap
 * would give on the first frame back to a tab that was hidden this long.
 */
const BIG_STEP_MS = 3000;
/** The longest step this ticker gives a model, in ms. */
const MAX_DELTA_MS = 100;

const WIDTH = 640;
const HEIGHT = 360;

// Two balls, rolling between two thin walls. The button takes one big step
// of three seconds, between the usual frames, as a ticker would on the first
// frame back to a tab that was hidden for three seconds. The top ball is
// given all of it in one step. The bottom ball is given a step capped at
// 100 ms, as a ticker with a cap would give it. Press Restart, below, to
// start again.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0d1520,
    start: ({ stage }) => {
        const uncapped = createBallModel({ leftWall: 40, rightWall: 600 });
        const capped = createBallModel({ leftWall: 40, rightWall: 600 });

        const top = LaneView({
            title: `no cap: update(${BIG_STEP_MS})`,
            x: () => uncapped.x,
            radius: uncapped.radius,
            leftWall: uncapped.leftWall,
            rightWall: uncapped.rightWall,
            wallThickness: uncapped.wallThickness,
        });
        top.y = 24;
        const bottom = LaneView({
            title: `capped: update(${Math.min(BIG_STEP_MS, MAX_DELTA_MS)})`,
            x: () => capped.x,
            radius: capped.radius,
            leftWall: capped.leftWall,
            rightWall: capped.rightWall,
            wallThickness: capped.wallThickness,
        });
        bottom.y = 144;

        const button = ButtonView({ label: `Take one ${BIG_STEP_MS / 1000}-second step`, width: BUTTON_WIDTH, onPressed: takeOneBigStep });
        button.position.set((WIDTH - BUTTON_WIDTH) / 2, 290);

        stage.addChild(top, bottom, button);

        // The usual frames: both balls get the same small steps
        return {
            update(deltaMs: number) {
                uncapped.update(deltaMs);
                capped.update(deltaMs);
            },
        };

        // One big step for each ball, between the usual frames, capped for one of them
        function takeOneBigStep(): void {
            uncapped.update(BIG_STEP_MS);
            capped.update(Math.min(BIG_STEP_MS, MAX_DELTA_MS));
        }
    },
});

const BUTTON_WIDTH = 240;
