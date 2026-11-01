import { definePixiProject } from 'playground';
import { createStageModel } from './models';
import { StageView } from './views';

const WIDTH = 640;
const HEIGHT = 360;

// The project: a game of timed stages, a view of it, and an audio view that
// plays its music on the project's sound chip. The playground ticks what
// `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0b1020,
    start: ({ stage, sound }) => {
        const model = createStageModel();
        stage.addChild(StageView({ model, music: sound, width: WIDTH, height: HEIGHT }));
        return model;
    },
});
