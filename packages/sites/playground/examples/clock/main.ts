import { definePixiProject } from 'playground';
import { createClockModel } from './models';
import { ClockView } from './views';

const WIDTH = 300;
const HEIGHT = 200;

// The project: a model of the time, and a view of it on the stage. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0a0a1e,
    start: ({ stage }) => {
        const model = createClockModel();
        stage.addChild(ClockView({ model, width: WIDTH, height: HEIGHT }));
        return model;
    },
});
