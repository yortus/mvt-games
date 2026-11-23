import { Camera3D } from '@pixi/3d';
import { setRefresh, setUpdate } from '@mvtjs/pixi-3d';
import type { PlayRect } from '@mvtjs/site-kit/entry-types';
import { frameScreen, type ScreenFraming, type ScreenPlacement } from '@mvtjs/site-kit/showcase';
import { CAMERA_UP, placeReadingEye, placeReadingTarget } from './paper-camera';
import { FIELD_OF_VIEW, SCREEN_HEIGHT } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PaperCameraViewBindings {
    /** Where across the desk the reader looks, in metres. */
    readonly centreX: () => number;
    /** The box of the puzzle the reader has leant in to, as a screen, or undefined while reading. */
    readonly screenInPlay: () => ScreenPlacement | undefined;
    /** Where that box should land in the view, in the view's pixels, if somewhere other than the middle. */
    readonly rectInPlay: () => PlayRect | undefined;
    /** How far the reader has leant in, from 0 to 1. */
    readonly lean: () => number;
    /** How wide the paper's view is, in pixels, as it fits itself to the page. Its height is always `SCREEN_HEIGHT`. */
    readonly viewWidth: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The reader's eyes. Reading, they look down at the paper from in front of
 * the desk, at whatever is open. As the reader leans in to a puzzle, the
 * camera glides until it looks straight down on the puzzle's box, with the
 * box where the puzzle will play, and back out as they lean back. The
 * framing is worked out as each lean in begins, and again if the box or
 * the view's width changes.
 */
export function PaperCameraView({ centreX, screenInPlay, rectInPlay, lean, viewWidth }: PaperCameraViewBindings): Camera3D {
    const camera = new Camera3D({ fov: FIELD_OF_VIEW, near: 0.02, far: 8 });
    // Presentation state: the framing of the box in play, and the box and width it was worked out for
    let framing: ScreenFraming | undefined;
    let framedScreen: ScreenPlacement | undefined;
    let framedWidth = 0;
    const eye = { x: 0, y: 0, z: 0 };
    const lookAt = { x: 0, y: 0, z: 0 };

    setUpdate(camera, () => {
        const screen = screenInPlay();
        const width = viewWidth();
        if (screen === framedScreen && width === framedWidth) return;
        framedScreen = screen;
        framedWidth = width;
        framing = screen === undefined ? undefined : frameScreen({ screen, rect: rectInPlay(), viewWidth: width, viewHeight: SCREEN_HEIGHT, fieldOfView: FIELD_OF_VIEW });
    });

    setRefresh(camera, () => {
        const x = centreX();
        placeReadingEye(x, eye);
        placeReadingTarget(x, lookAt);
        const amount = lean();
        if (framing !== undefined && amount > 0) {
            // Eased in and out, so the glide starts and ends gently
            const t = amount * amount * (3 - 2 * amount);
            eye.x += (framing.eyeX - eye.x) * t;
            eye.y += (framing.eyeY - eye.y) * t;
            eye.z += (framing.eyeZ - eye.z) * t;
            lookAt.x += (framing.lookX - lookAt.x) * t;
            lookAt.y += (framing.lookY - lookAt.y) * t;
            lookAt.z += (framing.lookZ - lookAt.z) * t;
        }
        camera.position.set(eye.x, eye.y, eye.z);
        camera.lookAt(lookAt, CAMERA_UP);
    });
    return camera;
}
