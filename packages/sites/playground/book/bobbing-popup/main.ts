import { definePixiProject } from 'playground';
import { createPopupModel } from './models';
import { StageView } from './views';

const WIDTH = 560;
const HEIGHT = 280;

// The project: a model of a popup, and a view of it on the stage. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x10141f,
    start: ({ stage }) => {
        const model = createPopupModel();
        stage.addChild(StageView({ model, width: WIDTH, height: HEIGHT }));
        return model;
    },
});
