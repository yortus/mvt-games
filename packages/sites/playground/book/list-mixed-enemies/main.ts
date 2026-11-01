import { definePixiProject } from 'playground';
import { createSkyModel } from './models';
import { SkyView } from './views';

const WIDTH = 640;
const HEIGHT = 360;
/** The sky's height. Below it, a panel shows the list's slots. */
const SKY_HEIGHT = 290;

// The project: a model of the sky and its enemies, and a view of them on the
// stage. The playground ticks what `start` returns, then updates and
// refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0b1020,
    start: ({ stage }) => {
        const model = createSkyModel({ width: WIDTH, height: SKY_HEIGHT, seed: 7 });
        stage.addChild(SkyView({ model, width: WIDTH, height: SKY_HEIGHT }));
        return model;
    },
});
