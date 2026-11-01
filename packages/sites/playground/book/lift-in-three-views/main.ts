import { definePixiProject } from 'playground';
import { createLiftModel } from './models';
import { LiftWindowsView } from './views';

// The project: a model of a lift, and three views of it on the stage. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: 640,
    height: 320,
    background: 0x10141f,
    start: ({ stage }) => {
        const model = createLiftModel();
        stage.addChild(LiftWindowsView({ model }));
        return model;
    },
});
