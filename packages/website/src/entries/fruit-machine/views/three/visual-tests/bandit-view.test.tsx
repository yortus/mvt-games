import { PerspectiveCamera } from 'three';
import { advanceTime } from '@mvtjs/three';
import { type CanvasTestOptions, canvasTest } from 'v-snap';
import { createFruitMachineModel } from '../../../models';
import { loadSymbolArt } from '../../art';
import { dressBanditScene, frameBanditCamera } from '../bandit-scene';
import { BanditView } from '../bandit-view';

// The bandit is framed and lit as the page does it. The image has the shape
// that the bandit's quadrant usually has in the machine.
const IMAGE = { kind: 'three', width: 480, height: 360, camera: createBanditCamera, scene: dressBanditScene } satisfies CanvasTestOptions<'three'>;
const SEED = 7;

canvasTest('ready to spin', IMAGE, async () => {
    const model = createFruitMachineModel({ seed: SEED });
    return BanditView({ model, art: await loadSymbolArt(), dragSurface: document.createElement('div') });
});

// Mid-spin, the drums are turning, the lever is on its way back, and the
// cabinet has swayed a little.
canvasTest('mid-spin', IMAGE, async () => {
    const model = createFruitMachineModel({ seed: SEED });
    const view = BanditView({ model, art: await loadSymbolArt(), dragSurface: document.createElement('div') });
    void model.spin();
    await advanceTime(600, model, view);
    return view;
});

function createBanditCamera(): PerspectiveCamera {
    const camera = new PerspectiveCamera(30, IMAGE.width / IMAGE.height, 0.1, 100);
    frameBanditCamera({ camera });
    return camera;
}
