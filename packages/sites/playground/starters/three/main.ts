import { defineThreeProject } from 'playground';
import { createCycleModel } from './models';
import { CubeView } from './views';

// The project: a model of a cycle that repeats, and a view of it in the
// scene, a cube that turns once each cycle. The playground ticks what
// `start` returns, then updates and refreshes the views. Change anything,
// and the project runs again.
export const project = defineThreeProject({
    width: 400,
    height: 300,
    start: ({ scene }) => {
        const model = createCycleModel({ periodMs: 10_000 });
        scene.add(CubeView({ progress: () => model.progress }));
        return model;
    },
});
