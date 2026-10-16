import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { createPendulumModel } from '../../models';
import { PendulumView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../pendulum-view';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('at rest, before it is let go', SIZE, () => PendulumView({ model: createPendulumModel() }));

// The trail is full, and the slow button lit
canvasTest('swinging slowly', SIZE, async () => {
    const model = createPendulumModel();
    const view = PendulumView({ model });
    await advanceTime(3000, model, view);
    model.playback = 'slow';
    await advanceTime(2000, model, view);
    return view;
});
