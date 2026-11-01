import { definePixiProject } from 'playground';
import { createTurnOrderModel } from './models';
import { TableView } from './views';

const WIDTH = 640;
const HEIGHT = 360;

// The project: a model of whose turn it is, and a view of the players' cards.
// The playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x10301f,
    start: ({ stage }) => {
        const model = createTurnOrderModel({ players: ['Ada', 'Bo', 'Cy', 'Di'] });
        stage.addChild(TableView({ model, width: WIDTH, height: HEIGHT }));
        return model;
    },
});
