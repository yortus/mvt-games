import { createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'vsnap';
import { CAT_SPAWNS, MAZE_DATA, MOUSE_SPAWN, PEN_EXIT, textures } from '../../data';
import { createGameModel } from '../../models';
import { GameView } from '../game-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';

async function poseGame(advanceMs: number): Promise<ReturnType<typeof GameView>> {
    await textures.load();
    const model = createGameModel({ grid: MAZE_DATA, mouseSpawn: MOUSE_SPAWN, catSpawns: CAT_SPAWNS, penExit: PEN_EXIT });
    // A headless chip makes no sound, and an image does not depend on what plays.
    const view = GameView({ model, sound: createHeadlessAudio80().audio80 });
    await advanceTime(advanceMs, model, view);
    return view;
}

canvasTest('at the start', { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }, () => poseGame(0));
// The cats leave their pen, and the mouse runs on its own until the player
// steers it.
canvasTest('two seconds in', { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }, () => poseGame(2000));
