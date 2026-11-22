import { Camera3D } from '@pixi/3d';
import { setRefresh, setUpdate } from '@mvtjs/pixi-3d';
import { createReaction, increased } from '@mvtjs/utils';
import { MAX_SPEED } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ChaseCameraViewBindings {
    /** Where the car is on the ground, in metres. */
    readonly carX: () => number;
    readonly carZ: () => number;
    /** The angle of the car's nose from +x toward +z, in radians. */
    readonly carHeading: () => number;
    /** The car's speed, in metres per second. The view widens as it rises, which makes speed feel faster. */
    readonly carSpeed: () => number;
    /** How many wrecks there have been. Each rise shakes the camera. */
    readonly wrecks: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A camera that follows the car from behind and above. It trails a little,
 * so it swings wide on a turn and drops back as the car speeds up, which
 * shows the car's motion. Where it trails to is presentation state, which
 * the model doesn't track, so the view keeps it, advanced in its update
 * step. It jumps straight to the car when the car jumps, as at a restart.
 */
export function ChaseCameraView(bindings: ChaseCameraViewBindings): Camera3D {
    const { carX, carZ, carHeading, carSpeed, wrecks } = bindings;
    const camera = new Camera3D({ fov: FIELD_OF_VIEW });
    // Where the camera is, and the point it looks at, kept between frames
    let cameraX = 0;
    let cameraZ = 0;
    const lookAt = { x: 0, y: LOOK_HEIGHT, z: 0 };
    // How much longer the camera shakes, and a clock the shake follows
    let shakeMs = 0;
    let clockMs = 0;
    jumpBehindCar();
    const shakeWhenWrecked = createReaction({
        watch: wrecks,
        when: increased,
        react: () => {
            shakeMs = SHAKE_MS;
        },
    });

    setUpdate(camera, (deltaMs) => {
        shakeWhenWrecked();
        clockMs += deltaMs;
        shakeMs = Math.max(0, shakeMs - deltaMs);
        const targetX = carX() - Math.cos(carHeading()) * TRAIL_DISTANCE;
        const targetZ = carZ() - Math.sin(carHeading()) * TRAIL_DISTANCE;
        if (Math.hypot(targetX - cameraX, targetZ - cameraZ) > JUMP_DISTANCE) {
            jumpBehindCar();
            return;
        }
        // Eases toward the spot behind the car, by the same share of the gap in the same time, at any frame rate
        const ease = 1 - Math.exp(-deltaMs / TRAIL_MS);
        cameraX += (targetX - cameraX) * ease;
        cameraZ += (targetZ - cameraZ) * ease;
    });

    setRefresh(camera, () => {
        // The shake fades as it runs out, wobbling at a few unrelated rates so it doesn't look regular
        const shake = (shakeMs / SHAKE_MS) * SHAKE_SIZE;
        const wobbleX = Math.sin(clockMs * 0.071) * shake;
        const wobbleY = Math.sin(clockMs * 0.053 + 1) * shake * 0.6;
        const wobbleZ = Math.sin(clockMs * 0.089 + 2) * shake;
        camera.position.set(cameraX + wobbleX, CAMERA_HEIGHT + wobbleY, cameraZ + wobbleZ);
        camera.fov = FIELD_OF_VIEW + FAST_EXTRA_FIELD_OF_VIEW * Math.min(1, Math.abs(carSpeed()) / MAX_SPEED);
        lookAt.x = carX() + Math.cos(carHeading()) * LOOK_AHEAD;
        lookAt.z = carZ() + Math.sin(carHeading()) * LOOK_AHEAD;
        camera.lookAt(lookAt);
    });
    return camera;

    function jumpBehindCar(): void {
        cameraX = carX() - Math.cos(carHeading()) * TRAIL_DISTANCE;
        cameraZ = carZ() - Math.sin(carHeading()) * TRAIL_DISTANCE;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The field of view at a standstill, and how much wider it gets at top speed, in degrees. */
const FIELD_OF_VIEW = 56;
const FAST_EXTRA_FIELD_OF_VIEW = 14;
/** How long a wreck shakes the camera, and how far, in metres, at first. */
const SHAKE_MS = 700;
const SHAKE_SIZE = 1.2;
/**
 * How far behind the car the camera sits, once it has caught up, and how
 * high, in metres. It's high and well back, so you can see the cars round
 * you, and a missile coming up behind.
 */
const TRAIL_DISTANCE = 16;
const CAMERA_HEIGHT = 9.5;
/** How far ahead of the car, and how high, the camera looks. */
const LOOK_AHEAD = 12;
const LOOK_HEIGHT = 0;
/** How quickly the camera catches up, as the time it takes to close most of the gap. */
const TRAIL_MS = 140;
/** A gap so big that the car must have jumped, not driven. */
const JUMP_DISTANCE = 45;
