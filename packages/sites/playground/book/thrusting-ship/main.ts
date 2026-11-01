import { definePixiProject } from 'playground';
import { createShipModel } from './models';
import { ShipView } from './views';

const WIDTH = 640;
const HEIGHT = 360;

// A ship that falls, and climbs while you hold the thrust on. The model has
// one property for the player's input, isThrusting, which says what the
// player means. The view decides which controls mean it.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0d1520,
    start: ({ stage }) => {
        const model = createShipModel({ startX: WIDTH / 2, startY: 120 });
        stage.addChild(ShipView({ model, width: WIDTH, height: HEIGHT }));
        return model;
    },
});
