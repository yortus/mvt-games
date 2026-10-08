import { PerspectiveCamera } from 'three';
import { describe } from 'vitest';
import { advanceTime, type ThreePictureOptions, visualTest } from '#testing';
import { createFruitMachineModel } from '../../models';
import { loadSymbolArt } from '../art';
import { dressBanditScene, frameBanditCamera } from './bandit-scene';
import { BanditView } from './bandit-view';

// As the page frames and lights it, in a quadrant of the machine's usual shape
const PICTURE: ThreePictureOptions = { width: 480, height: 360, camera: banditCamera, scene: dressBanditScene };
const SEED = 7;

describe('BanditView', () => {
    visualTest('ready to spin', async () => {
        const model = createFruitMachineModel({ seed: SEED });
        return BanditView({ model, art: await loadSymbolArt(), dragSurface: document.createElement('div') });
    }, PICTURE);

    // The drums turning, the lever on its way back, the cabinet swayed a little
    visualTest('mid-spin', async () => {
        const model = createFruitMachineModel({ seed: SEED });
        const view = BanditView({ model, art: await loadSymbolArt(), dragSurface: document.createElement('div') });
        void model.spin();
        await advanceTime({ models: [model], views: [view], totalMs: 600 });
        return view;
    }, PICTURE);
});

function banditCamera(): PerspectiveCamera {
    const camera = new PerspectiveCamera(30, PICTURE.width / PICTURE.height, 0.1, 100);
    frameBanditCamera({ camera });
    return camera;
}
