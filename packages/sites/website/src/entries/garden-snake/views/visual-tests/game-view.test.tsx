import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { createGameModel } from '../../models';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../game-view';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('at the start', SIZE, () => GameView({ model: createGameModel() }));

// Partway between two cells, after a turn
canvasTest('sliding round a turn', SIZE, async () => {
    const model = createGameModel();
    const view = GameView({ model });
    await advanceTime(500, model, view);
    model.direction = 'down';
    await advanceTime(380, model, view);
    return view;
});

// Straight on into the fence
canvasTest('game over', SIZE, async () => {
    const model = createGameModel();
    const view = GameView({ model });
    await advanceTime(5000, model, view);
    return view;
});
