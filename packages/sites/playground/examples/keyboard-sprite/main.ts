import { definePixiProject } from 'playground';
import { createSpriteModel } from './models';
import { SpriteView } from './views';

const WIDTH = 400;
const HEIGHT = 300;

// The project: a model of the sprite, and a view of it on the stage. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0d1520,
    start: ({ stage }) => {
        const model = createSpriteModel({ width: WIDTH, height: HEIGHT });
        stage.addChild(SpriteView({ model, width: WIDTH, height: HEIGHT }));
        return model;
    },
});
