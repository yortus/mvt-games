import { PerspectiveCamera } from 'three';
import { describe } from 'vitest';
import { advanceTime, type ThreePictureOptions, visualTest } from '#testing';
import { LEVER_LENGTH, LEVER_X, LEVER_Y, LEVER_Z } from './bandit-layout';
import { dressBanditScene } from './bandit-scene';
import { LeverView } from './lever-view';
import { createMaterialKit } from './material-kit';

// The camera looks from the side, where the lever's swing towards the player
// shows as an angle. The lever is drawn in the bandit's own scene, so it
// shines as it does there.
const PICTURE: ThreePictureOptions = { width: 240, height: 300, camera: createSideCamera, scene: dressBanditScene };

describe('LeverView', () => {
    visualTest('at rest', () => LeverView({ kit: createMaterialKit(), spinCount: () => 0 }), PICTURE);

    // A spin pulls the lever. It goes down fast, then springs back past upright.
    visualTest('200 ms into a pull', () => posePulledLever(200), PICTURE);
    visualTest('450 ms into a pull', () => posePulledLever(450), PICTURE);
});

async function posePulledLever(totalMs: number): Promise<ReturnType<typeof LeverView>> {
    let spinCount = 0;
    const lever = LeverView({ kit: createMaterialKit(), spinCount: () => spinCount });
    spinCount++;
    await advanceTime({ views: [lever], totalMs });
    return lever;
}

function createSideCamera(): PerspectiveCamera {
    const camera = new PerspectiveCamera(35, 1, 0.1, 100);
    const middleY = LEVER_Y + LEVER_LENGTH / 2;
    camera.position.set(LEVER_X + 8, middleY + 1, LEVER_Z + 2.5);
    camera.lookAt(LEVER_X, middleY, LEVER_Z + 1.2);
    return camera;
}
