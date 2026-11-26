import { createHeadlessAudio80 } from 'audio90/headless';
import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { createArcadeControls } from '@mvtjs/site-kit/input';
import { WAVES, textures } from '../../data';
import { createGameModel, GAME_TUNING, type GameModel } from '../../models';
import { GameView } from '../game-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';

// The raiders have flown into formation, and the ship has fired a shot.
canvasTest('a shot on its way up', { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }, async () => {
    const { model, view } = await createGame(1);
    await advanceTime(1800, model, view);
    model.fire();
    await advanceTime(300, model, view);
    return view;
});

// The first wave's raiders dive every 3 seconds, once they're all in formation.
canvasTest('a raider diving', { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }, async () => {
    const { model, view } = await createGame(1);
    await advanceTime(5500, model, view);
    return view;
});

/** Creates the game with a seed, and its view with headless chips, which stay silent, since an image doesn't depend on what plays. */
async function createGame(seed: number): Promise<{ model: GameModel; view: ReturnType<typeof GameView> }> {
    await textures.load();
    const model = createGameModel({ waves: WAVES, tuning: GAME_TUNING, seed });
    const view = GameView({ model, music: createHeadlessAudio80(), sfx: createHeadlessAudio80(), controls: createArcadeControls() });
    return { model, view };
}
