import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { createRandom } from '@mvtjs/site-kit/random';
import { createDemoModel } from '../../models';
import { DemoView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../demo-view';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('seeds just planted, with the first caption', SIZE, () => DemoView({ model: createDemoModel({ random: createRandom({ seed: 1 }) }) }));

canvasTest('coral after five seconds', SIZE, async () => {
    const model = createDemoModel({ random: createRandom({ seed: 1 }) });
    const view = DemoView({ model });
    await advanceTime(5000, model, view);
    return view;
});

// Halfway through the first colour scheme's fade into the second, 32 seconds in. The colours are the view's own, so
// only the view moves on to that moment, and the test doesn't run 27 more seconds of the simulation. The coral stays
// as it was at five seconds.
canvasTest('coral, in changing colours', SIZE, async () => {
    const model = createDemoModel({ random: createRandom({ seed: 1 }) });
    const view = DemoView({ model });
    await advanceTime(5000, model, view);
    await advanceTime(27_000, view);
    return view;
});
