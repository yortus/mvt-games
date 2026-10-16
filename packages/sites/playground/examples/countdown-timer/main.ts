import { definePixiProject } from 'playground';
import { createTimerModel } from './models';
import { TimerView } from './views';

const WIDTH = 300;
const HEIGHT = 200;

// The project: a model of the timer, and a view of it on the stage. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x141020,
    start: ({ stage }) => {
        const model = createTimerModel({ durationMs: 10_000 });
        stage.addChild(TimerView({ model, width: WIDTH }));
        return model;
    },
});
