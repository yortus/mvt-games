import { advanceTime, Scene3DView } from '@mvtjs/pixi-3d';
import { canvasTest } from 'v-snap';
import { createDemoModel } from '../../models';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../demo-view';
import { OrreryView } from '../orrery-view';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

/** The orrery a few seconds in, seen from a camera turned `yaw` round from the front, tilted `tilt`, and `distance` away. */
async function poseCamera(yaw: number, tilt: number, distance: number) {
    const model = createDemoModel();
    const view = Scene3DView({
        scene: OrreryView({ model, cameraYaw: () => yaw, cameraTilt: () => tilt, cameraDistance: () => distance }),
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        background: 0x10121c,
        environment: { skyColor: 0x4a5070, groundColor: 0x20140c },
    });
    await advanceTime(3000, model, view);
    return view;
}

// Nearly straight down, far enough back that every world stays in view
canvasTest('looked down on from above', SIZE, () => poseCamera(0, 1.45, 9));

// Nearly level with the plinth, from the side, so the arms' heights and the rods show
canvasTest('seen from the side', SIZE, () => poseCamera(Math.PI / 2, 0.05, 5));

// Close in from the right, a little behind, with the drive arbor's stack of gears beside the tubes', so each pair's teeth show in mesh
canvasTest('close in on the gears', SIZE, () => poseCamera(2.1, 0.6, 1.6));
