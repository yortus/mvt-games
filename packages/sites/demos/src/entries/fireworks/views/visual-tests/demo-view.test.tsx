import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { createDemoModel } from '../../models';
import { DemoView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../demo-view';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('before the first burst', SIZE, async () => {
    const model = createDemoModel();
    const view = DemoView({ model });
    await advanceTime(500, model, view);
    return view;
});

canvasTest('in full swing', SIZE, async () => {
    const model = createDemoModel();
    const view = DemoView({ model });
    await advanceTime(5000, model, view);
    return view;
});
