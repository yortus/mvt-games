import { definePixiProject } from 'playground';
import { createFrenzyModel } from './models';
import { FrenzyView } from './views';

const WIDTH = 400;
const HEIGHT = 300;

// The project: a model of the targets and the score, and a view of them on
// the stage. The playground ticks what `start` returns, then updates and
// refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x1a0a24,
    start: ({ stage }) => {
        const model = createFrenzyModel({ width: WIDTH, height: HEIGHT });
        stage.addChild(FrenzyView({ model, width: WIDTH, height: HEIGHT }));
        return model;
    },
});
