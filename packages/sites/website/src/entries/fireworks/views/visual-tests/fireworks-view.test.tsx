import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { createFireworksModel } from '../../models';
import { FireworksView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../fireworks-view';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('before the first burst', SIZE, async () => {
    const model = createFireworksModel();
    const view = FireworksView({ model });
    await advanceTime(500, model, view);
    return view;
});

canvasTest('in full swing', SIZE, async () => {
    const model = createFireworksModel();
    const view = FireworksView({ model });
    await advanceTime(5000, model, view);
    return view;
});
