import { PerspectiveCamera } from 'three';
import { describe } from 'vitest';
import { advanceTime, type ThreePictureOptions, canvasTest } from '@mvtjs/visual-testing';
import { createFruitMachineModel } from '../../models';
import { loadSymbolArt } from '../art';
import { dressBanditScene, frameBanditCamera } from './bandit-scene';
import { BanditView } from './bandit-view';

// The bandit is framed and lit as the page does it. The picture has the shape
// that the bandit's quadrant usually has in the machine.
const PICTURE: ThreePictureOptions = { width: 480, height: 360, camera: createBanditCamera, scene: dressBanditScene };
const SEED = 7;

describe('BanditView', () => {
    canvasTest('ready to spin', async () => {
        const model = createFruitMachineModel({ seed: SEED });
        return BanditView({ model, art: await loadSymbolArt(), dragSurface: document.createElement('div') });
    }, PICTURE);

    // Mid-spin, the drums are turning, the lever is on its way back, and the
    // cabinet has swayed a little.
    canvasTest('mid-spin', async () => {
        const model = createFruitMachineModel({ seed: SEED });
        const view = BanditView({ model, art: await loadSymbolArt(), dragSurface: document.createElement('div') });
        void model.spin();
        await advanceTime({ models: [model], views: [view], totalMs: 600 });
        return view;
    }, PICTURE);
});

function createBanditCamera(): PerspectiveCamera {
    const camera = new PerspectiveCamera(30, PICTURE.width / PICTURE.height, 0.1, 100);
    frameBanditCamera({ camera });
    return camera;
}
