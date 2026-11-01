import { definePixiProject } from 'playground';
import { createStopwatchModel } from './models';
import { StopwatchView } from './views';

// The project: a model of a stopwatch, and a view of it on the stage. The
// stopwatch is started here, so you can see it run. The playground ticks
// what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: 640,
    height: 300,
    background: 0x10141f,
    start: ({ stage }) => {
        const model = createStopwatchModel();
        model.start();
        stage.addChild(StopwatchView({ model }));
        return model;
    },
});
