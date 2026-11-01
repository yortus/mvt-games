import { definePixiProject } from 'playground';
import { createShooterModel } from './models';
import { ShooterView } from './views';

const WIDTH = 640;
const HEIGHT = 360;
/** The play area's height. Below it, a panel shows the list's slots. */
const PLAY_HEIGHT = 290;

// The project: a model of the ship and its bullets, and a view of them on the
// stage. The playground ticks what `start` returns, then updates and
// refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0b1020,
    start: ({ stage }) => {
        const model = createShooterModel({ width: WIDTH, height: PLAY_HEIGHT });
        stage.addChild(ShooterView({ model, width: WIDTH, height: PLAY_HEIGHT }));
        return model;
    },
});
