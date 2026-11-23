import { Camera3D } from '@pixi/3d';
import { setRefresh, setUpdate } from '@mvtjs/pixi-3d';
import { EYE_HEIGHT, FIELD_OF_VIEW } from '../data';
import { MEADOW_BACKDROP_DISTANCE } from './meadow-backdrop-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MeadowCameraViewBindings {
    /** Where the player stands, in metres, and the way they face and look. */
    readonly playerX: () => number;
    readonly playerZ: () => number;
    readonly playerHeading: () => number;
    readonly playerPitch: () => number;
    /** The height of the ground under the player, in metres. */
    readonly groundHeight: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The player's eyes, outside. The ground's slope changes sharply at the
 * river's banks, so the eyes ease after it, rather than jolting.
 */
export function MeadowCameraView(bindings: MeadowCameraViewBindings): Camera3D {
    const { playerX, playerZ, playerHeading, playerPitch, groundHeight } = bindings;
    const camera = new Camera3D({ fov: FIELD_OF_VIEW, near: 0.1, far: MEADOW_BACKDROP_DISTANCE * 1.2 });
    /** The eyes' height, easing toward the ground's, in metres. */
    let eyeY = groundHeight() + EYE_HEIGHT;
    const lookAt = { x: 0, y: 0, z: 0 };

    setUpdate(camera, (deltaMs) => {
        const target = groundHeight() + EYE_HEIGHT;
        eyeY += (target - eyeY) * (1 - Math.exp(-deltaMs / EYE_EASE_MS));
    });

    setRefresh(camera, () => {
        const heading = playerHeading();
        const pitch = playerPitch();
        const x = playerX();
        const z = playerZ();
        lookAt.x = x + Math.cos(heading) * Math.cos(pitch);
        lookAt.y = eyeY + Math.sin(pitch);
        lookAt.z = z + Math.sin(heading) * Math.cos(pitch);
        camera.position.set(x, eyeY, z);
        camera.lookAt(lookAt);
    });
    return camera;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How quickly the eyes catch up with a step in the ground. */
const EYE_EASE_MS = 110;
