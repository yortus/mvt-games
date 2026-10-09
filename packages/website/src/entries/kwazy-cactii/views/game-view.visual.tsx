import { describe } from 'vitest';
import { createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { advanceTime, visualTest } from '@mvtjs/visual-testing';
import { textures } from '../data';
import { createGameModel } from '../models';
import { GameView } from './game-view';

// The screen is 1600 by 2180, over the size budget, and pixel art is never
// drawn smaller. So each picture shows the top-left three by three tiles,
// which are 200 by 250 each.
const CROP = { width: 600, height: 750 };

describe('GameView', () => {
    visualTest('at the start', () => poseGame({ isRestarted: false }), CROP);

    // Random numbers are seeded the same in every test, so both tests start
    // from the same board. A restart deals a new one. If the view kept
    // showing the old board, this picture would match the one above.
    visualTest('after a restart', () => poseGame({ isRestarted: true }), CROP);
});

async function poseGame(options: { readonly isRestarted: boolean }): Promise<ReturnType<typeof GameView>> {
    await textures.load();
    const model = createGameModel();
    // A headless chip makes no sound, and a picture does not depend on what plays.
    const view = GameView({ model, sound: createHeadlessAudio80().audio80 });
    await advanceTime({ models: [model], views: [view], totalMs: 16 });
    if (options.isRestarted) {
        model.reset();
        await advanceTime({ models: [model], views: [view], totalMs: 16 });
    }
    return view;
}
