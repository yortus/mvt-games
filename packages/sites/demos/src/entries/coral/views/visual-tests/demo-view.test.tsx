import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { createRandom } from '@mvtjs/site-kit/random';
import { createDemoModel } from '../../models';
import { DemoView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../demo-view';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('seeds just planted, with the first caption', SIZE, () => DemoView({ model: createDemoModel({ random: createRandom({ seed: 1 }) }) }));

canvasTest('coral after twelve seconds', SIZE, async () => {
    const model = createDemoModel({ random: createRandom({ seed: 1 }) });
    const view = DemoView({ model });
    await advanceTime(12_000, model, view);
    return view;
});

// Moved on to spots, while the colours fade from the first scheme to the second
canvasTest('spots, in changing colours', SIZE, async () => {
    const model = createDemoModel({ random: createRandom({ seed: 1 }) });
    const view = DemoView({ model });
    await advanceTime(12_000, model, view);
    model.nextPattern();
    await advanceTime(20_000, model, view);
    return view;
});
