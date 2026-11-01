import { definePixiProject } from 'playground';
import { createDoorModel } from './models';
import { CorridorView } from './views';

const WIDTH = 620;
const HEIGHT = 280;

// The project: a model of a spaceship's door, and a view of it on the
// stage. The playground ticks what `start` returns, then updates and
// refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x10141c,
    start: ({ stage }) => {
        const model = createDoorModel();
        stage.addChild(CorridorView({ model, width: WIDTH, height: HEIGHT }));
        return model;
    },
});
