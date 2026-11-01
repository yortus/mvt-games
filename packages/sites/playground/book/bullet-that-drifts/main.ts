import { definePixiProject } from 'playground';
import { createBulletModel } from './models';
import { RangeView, TimeControlsView, type TimeSpeed } from './views';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How fast time runs for the model in slow motion, as a share of normal speed. */
const SLOW_MOTION_SCALE = 0.25;
/** The speed the example starts at. */
const STARTING_SPEED: TimeSpeed = 'slow';

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

const WIDTH = 600;
const HEIGHT = 270;
/** The width of the range, on the left. The time controls are to its right. */
const RANGE_WIDTH = 440;

/** How much of each frame's time the model gets, at each speed. */
const TIME_SCALES: Readonly<Record<TimeSpeed, number>> = {
    normal: 1,
    slow: SLOW_MOTION_SCALE,
    paused: 0,
};

// The project: a model of one bullet, a view of it on the stage, which shows
// the bullet twice, and buttons that choose how fast time runs for the
// model. The playground ticks what `start` returns, then updates and
// refreshes the views. Here `start` returns not the model itself, but a
// wrapper that scales the time before it reaches the model, as a game's loop
// would for slow motion or a pause. The views are refreshed every frame all
// the same.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x10141f,
    start: ({ stage }) => {
        const model = createBulletModel({ gunY: HEIGHT - 50, topY: 40 });
        let speed: TimeSpeed = STARTING_SPEED;

        const controls = TimeControlsView({
            speed: () => speed,
            onSpeedClicked: (chosen) => {
                speed = chosen;
            },
        });
        controls.position.set(RANGE_WIDTH + 16, 50);
        stage.addChild(RangeView({ model, width: RANGE_WIDTH }), controls);

        return {
            update: (deltaMs: number) => model.update(deltaMs * TIME_SCALES[speed]),
        };
    },
});
