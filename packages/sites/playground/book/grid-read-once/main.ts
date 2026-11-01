import { definePixiProject } from 'playground';
import { createLevelModel } from './models';
import { LevelView } from './views';

// The project: a model of a game whose grid grows with each level, and a
// view of it on the stage. The playground ticks what `start` returns, then
// updates and refreshes the views.
export const project = definePixiProject({
    width: 640,
    height: 290,
    background: 0x10141f,
    start: ({ stage }) => {
        const model = createLevelModel();
        stage.addChild(LevelView({ model }));
        return model;
    },
});
