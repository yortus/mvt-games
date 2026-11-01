import { definePixiProject } from 'playground';
import { createGemModel } from './models';
import { HuntView } from './views';

const WIDTH = 560;
const HEIGHT = 270;

// The project: a model of a hunt for gems, and a view of its score on the
// stage. The playground ticks what `start` returns, then updates and
// refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x10141f,
    start: ({ stage }) => {
        const model = createGemModel();
        stage.addChild(HuntView({ model, width: WIDTH, height: HEIGHT }));
        return model;
    },
});
