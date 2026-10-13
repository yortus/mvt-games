import { createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'vsnap';
import { textures } from '../../data';
import { createGameModel } from '../../models';
import { GameView } from '../game-view';

// The screen is 1600 by 2180, over the size budget, and pixel art is never
// drawn smaller. So each image shows the top-left three by three tiles,
// which are 200 by 250 each.
const CROP = { width: 600, height: 750 };

canvasTest('at the start', CROP, () => poseGame({ isRestarted: false }));

// Random numbers are seeded the same in every test, so both tests start
// from the same board. A restart deals a new one. If the view kept
// showing the old board, the two tests would produce the same image.
canvasTest('after a restart', CROP, () => poseGame({ isRestarted: true }));

async function poseGame(options: { readonly isRestarted: boolean }): Promise<ReturnType<typeof GameView>> {
    await textures.load();
    const model = createGameModel();
    // A headless chip makes no sound, and an image does not depend on what plays.
    const view = GameView({ model, sound: createHeadlessAudio80().audio80 });
    await advanceTime(16, model, view);
    if (options.isRestarted) {
        model.reset();
        await advanceTime(16, model, view);
    }
    return view;
}
