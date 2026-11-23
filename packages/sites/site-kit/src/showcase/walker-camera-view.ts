import { Camera3D } from '@pixi/3d';
import { setRefresh, setUpdate, type ValueOrGetter } from '@mvtjs/pixi-3d';
import type { PlayRect } from '../entry-types';
import { frameScreen, type ScreenFraming } from './frame-screen';
import type { ScreenPlacement } from './place-screen';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface WalkerCameraViewBindings {
    /** Where the walker stands, in metres, and the way they face. */
    readonly x: () => number;
    readonly z: () => number;
    readonly heading: () => number;
    /** How far the walker looks up, in radians, or down for less than 0. */
    readonly pitch: () => number;
    /** How high the walker's eyes are above the floor, in metres. */
    readonly eyeHeight: number;
    /** The screen the walker has stepped up to, or undefined while walking. */
    readonly screenInPlay: () => ScreenPlacement | undefined;
    /** Where that screen should land in the view, in the view's pixels, if somewhere other than the middle. */
    readonly rectInPlay: () => PlayRect | undefined;
    /** How far the walker has leant in to the screen in play, from 0 to 1. */
    readonly lean: () => number;
    /** The showcase's view, in pixels. Its width may change, for a showcase that fits itself to the page. */
    readonly viewWidth: ValueOrGetter<number>;
    readonly viewHeight: number;
    /** The camera's field of view, top to bottom, in degrees. */
    readonly fieldOfView: number;
    /** How far the camera sees, in metres. */
    readonly far: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The walker's eyes. Walking, it looks the way the walker faces, tilted up
 * or down as they look. As they lean in to a screen, it glides until the
 * screen fills the rectangle where the page will play the screen's entry,
 * square on. It glides back out as they step back. The framing is worked out
 * as each step up begins, and again if the screen or the view's width
 * changes.
 */
export function WalkerCameraView(bindings: WalkerCameraViewBindings): Camera3D {
    const { x, z, heading, pitch, eyeHeight, screenInPlay, rectInPlay, lean, viewWidth, viewHeight, fieldOfView, far } = bindings;
    const camera = new Camera3D({ fov: fieldOfView, near: 0.05, far });
    // Presentation state: the framing of the screen in play, and the screen and width it was worked out for
    let framing: ScreenFraming | undefined;
    let framedScreen: ScreenPlacement | undefined;
    let framedWidth = 0;
    const lookAt = { x: 0, y: 0, z: 0 };

    setUpdate(camera, () => {
        const screen = screenInPlay();
        const width = typeof viewWidth === 'function' ? viewWidth() : viewWidth;
        if (screen === framedScreen && width === framedWidth) return;
        framedScreen = screen;
        framedWidth = width;
        framing = screen === undefined ? undefined : frameScreen({ screen, rect: rectInPlay(), viewWidth: width, viewHeight, fieldOfView });
    });

    setRefresh(camera, () => {
        const facing = heading();
        const tilt = pitch();
        let eyeX = x();
        let eyeY = eyeHeight;
        let eyeZ = z();
        lookAt.x = eyeX + Math.cos(facing) * Math.cos(tilt);
        lookAt.y = eyeHeight + Math.sin(tilt);
        lookAt.z = eyeZ + Math.sin(facing) * Math.cos(tilt);
        const amount = lean();
        if (framing !== undefined && amount > 0) {
            // Eased in and out, so the glide starts and ends gently
            const t = amount * amount * (3 - 2 * amount);
            eyeX += (framing.eyeX - eyeX) * t;
            eyeY += (framing.eyeY - eyeY) * t;
            eyeZ += (framing.eyeZ - eyeZ) * t;
            lookAt.x += (framing.lookX - lookAt.x) * t;
            lookAt.y += (framing.lookY - lookAt.y) * t;
            lookAt.z += (framing.lookZ - lookAt.z) * t;
        }
        camera.position.set(eyeX, eyeY, eyeZ);
        camera.lookAt(lookAt);
    });
    return camera;
}
