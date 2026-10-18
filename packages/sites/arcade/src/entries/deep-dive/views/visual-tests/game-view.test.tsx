import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { createGameModel } from '../../models';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../game-view';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('at the mouth of the cave', SIZE, () => GameView({ model: createGameModel() }));

// Rising, with a trail of bubbles behind
canvasTest('rising', SIZE, async () => {
    const model = createGameModel();
    const view = GameView({ model });
    model.isBlowingTanks = true;
    await advanceTime(300, model, view);
    return view;
});

// One rise, then a long sink into the floor
canvasTest('crashed', SIZE, async () => {
    const model = createGameModel();
    const view = GameView({ model });
    model.isBlowingTanks = true;
    await advanceTime(16, model, view);
    model.isBlowingTanks = false;
    await advanceTime(5000, model, view);
    return view;
});
