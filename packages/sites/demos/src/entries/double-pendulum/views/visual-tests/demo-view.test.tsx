import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { createDemoModel } from '../../models';
import { DemoView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../demo-view';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('at rest, before it is let go', SIZE, () => DemoView({ model: createDemoModel() }));

// The trail is full, and the slow button lit
canvasTest('swinging slowly', SIZE, async () => {
    const model = createDemoModel();
    const view = DemoView({ model });
    await advanceTime(3000, model, view);
    model.playback = 'slow';
    await advanceTime(2000, model, view);
    return view;
});
