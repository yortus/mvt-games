import { definePixiProject } from 'playground';
import { createTrafficLightModel } from './models';
import { TrafficLightView } from './views';

// The project: a model of the traffic light, and a view of it on the stage.
// The playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: 200,
    height: 400,
    background: 0x0f1a0f,
    start: ({ stage }) => {
        const model = createTrafficLightModel();
        stage.addChild(TrafficLightView({ model }));
        return model;
    },
});
