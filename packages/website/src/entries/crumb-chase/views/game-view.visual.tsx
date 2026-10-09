import { describe } from 'vitest';
import { createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { advanceTime, visualTest } from '#testing';
import { CAT_SPAWNS, MAZE_DATA, MOUSE_SPAWN, PEN_EXIT, textures } from '../data';
import { createGameModel } from '../models';
import { GameView } from './game-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './view-constants';

async function poseGame(advanceMs: number): Promise<ReturnType<typeof GameView>> {
    await textures.load();
    const model = createGameModel({ grid: MAZE_DATA, mouseSpawn: MOUSE_SPAWN, catSpawns: CAT_SPAWNS, penExit: PEN_EXIT });
    // A headless chip makes no sound, and a picture does not depend on what plays
    const view = GameView({ model, sound: createHeadlessAudio80().audio80 });
    await advanceTime({ models: [model], views: [view], totalMs: advanceMs });
    return view;
}

describe('Crumb Chase GameView', () => {
    visualTest('at the start', () => poseGame(0), { width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
    // The cats leave their pen, and the mouse runs on its own until steered
    visualTest('two seconds in', () => poseGame(2000), { width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
});
