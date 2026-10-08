import { describe } from 'vitest';
import { advanceTime, visualTest } from '#testing';
import { CAT_SPAWNS, MAZE_DATA, MOUSE_SPAWN, PEN_EXIT, textures } from '../data';
import { createGameModel } from '../models';
import { GameView } from './game-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './view-constants';

async function game(advanceMs: number) {
    await textures.load();
    const model = createGameModel({ grid: MAZE_DATA, mouseSpawn: MOUSE_SPAWN, catSpawns: CAT_SPAWNS, penExit: PEN_EXIT });
    const view = GameView({ model });
    await advanceTime({ models: [model], views: [view], totalMs: advanceMs });
    return view;
}

describe('Crumb Chase GameView', () => {
    visualTest('at the start', () => game(0), { width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
    // The cats leave their pen, and the mouse runs on its own until steered
    visualTest('two seconds in', () => game(2000), { width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
});
