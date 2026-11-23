import type { PlayRect } from '../entry-types';
import type { ScreenPlacement } from './place-screen';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Where the camera stands to frame a screen, and the point it looks at, in metres. */
export interface ScreenFraming {
    readonly eyeX: number;
    readonly eyeY: number;
    readonly eyeZ: number;
    readonly lookX: number;
    readonly lookY: number;
    readonly lookZ: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FrameScreenOptions {
    readonly screen: ScreenPlacement;
    /**
     * Where the screen should land in the showcase's view, in the view's
     * pixels, such as where the page will play the screen's entry. Without
     * it, the screen lands in the middle of the view, as big as fits, with a
     * thin margin round it.
     */
    readonly rect: PlayRect | undefined;
    /** The showcase's view, in pixels. */
    readonly viewWidth: number;
    readonly viewHeight: number;
    /** The camera's field of view, top to bottom, in degrees. */
    readonly fieldOfView: number;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns where the camera stands to frame `screen` square on, so the screen
 * fills `rect` in the view. The camera faces the screen straight, so a
 * screen off the view's middle is framed by moving the camera across, not
 * by turning it. That way the screen stays square, and an entry played over
 * it lines up with it exactly. The screen's height is fitted to `rect`, so
 * `rect` must have the screen's shape, as an entry's play rectangle does.
 */
export function frameScreen({ screen, rect, viewWidth, viewHeight, fieldOfView }: FrameScreenOptions): ScreenFraming {
    const tanHalfFov = Math.tan((fieldOfView * Math.PI) / 360);
    const target = rect !== undefined && rect.height > 0 ? rect : centredRect(screen, viewWidth, viewHeight);
    // Far enough back that the screen's height spans the rectangle's
    const distance = (screen.height * viewHeight) / (2 * tanHalfFov * target.height);
    // How far the screen's middle sits right of, and above, the view's middle, in metres at the screen
    const metresPerPixel = (2 * distance * tanHalfFov) / viewHeight;
    const right = (target.x + target.width / 2 - viewWidth / 2) * metresPerPixel;
    const up = (viewHeight / 2 - (target.y + target.height / 2)) * metresPerPixel;
    const eyeX = screen.x + screen.normalX * distance - screen.rightX * right - screen.upX * up;
    const eyeY = screen.y + screen.normalY * distance - screen.upY * up;
    const eyeZ = screen.z + screen.normalZ * distance - screen.rightZ * right - screen.upZ * up;
    return { eyeX, eyeY, eyeZ, lookX: eyeX - screen.normalX, lookY: eyeY - screen.normalY, lookZ: eyeZ - screen.normalZ };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How much room is left round a screen framed in the middle of the view. */
const MARGIN = 1.06;

/** The screen's shape, as big as fits in the middle of the view, with a margin round it. */
function centredRect(screen: ScreenPlacement, viewWidth: number, viewHeight: number): PlayRect {
    const scale = Math.min(viewWidth / screen.width, viewHeight / screen.height) / MARGIN;
    const width = screen.width * scale;
    const height = screen.height * scale;
    return { x: (viewWidth - width) / 2, y: (viewHeight - height) / 2, width, height };
}
