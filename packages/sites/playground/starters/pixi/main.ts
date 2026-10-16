import { definePixiProject } from 'playground';
import { createCycleModel } from './models';
import { SpinnerView } from './views';

const WIDTH = 400;
const HEIGHT = 300;

// The project: a model of a cycle that repeats, and a view of it on the
// stage, a square that turns once each cycle. The playground ticks what
// `start` returns, then updates and refreshes the views. Change anything,
// and the project runs again.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    start: ({ stage }) => {
        const model = createCycleModel({ periodMs: 4000 });
        stage.addChild(SpinnerView({ progress: () => model.progress, x: WIDTH / 2, y: HEIGHT / 2 }));
        return model;
    },
});
