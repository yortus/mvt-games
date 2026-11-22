import { Scene3DView } from '@mvtjs/pixi-3d';
import { definePixiProject } from 'playground';
import { createCycleModel } from './models';
import { CrateSceneView } from './views';

const WIDTH = 400;
const HEIGHT = 300;

// This project has a model of a cycle that repeats, and a 3D scene of a
// crate that turns once each cycle. `Scene3DView` shows the scene on the
// Pixi stage. The playground ticks the model that `start` returns, then
// updates and refreshes the views, both 2D and 3D. Change anything, and
// the project runs again.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    start: ({ stage }) => {
        const model = createCycleModel({ periodMs: 6000 });
        const scene = CrateSceneView({ progress: () => model.progress });
        stage.addChild(Scene3DView({ scene, width: WIDTH, height: HEIGHT, background: 0x1d2433 }));
        return model;
    },
});
