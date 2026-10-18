import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { createCoralModel } from '../../models';
import { CoralView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../coral-view';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('seeds just planted, with the first caption', SIZE, () => CoralView({ model: createCoralModel() }));

canvasTest('coral after twelve seconds', SIZE, async () => {
    const model = createCoralModel();
    const view = CoralView({ model });
    await advanceTime(12_000, model, view);
    return view;
});

// Moved on to spots, while the colours fade from the first scheme to the second
canvasTest('spots, in changing colours', SIZE, async () => {
    const model = createCoralModel();
    const view = CoralView({ model });
    await advanceTime(12_000, model, view);
    model.nextPattern();
    await advanceTime(20_000, model, view);
    return view;
});
