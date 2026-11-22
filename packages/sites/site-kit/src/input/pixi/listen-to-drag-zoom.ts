import { type Container, type FederatedPointerEvent, type FederatedWheelEvent, Point } from 'pixi.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What to watch, and where to report. Distances are in the target's own pixels. */
export interface DragZoomOptions {
    /** The container a gesture must start on. It receives pointer events from now on. */
    readonly target: Container;
    /** One finger, or the mouse, moved by `deltaX` and `deltaY` since the last report. */
    readonly onDragged?: (deltaX: number, deltaY: number) => void;
    /** Two fingers pinched, or the wheel turned, by `factor`. Above 1 is closer in. */
    readonly onZoomed?: (factor: number) => void;
    /** A finger or the mouse went down while none was down. */
    readonly onGestureBegan?: () => void;
    /** The last finger or the mouse came up, or was lost. */
    readonly onGestureEnded?: () => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Turns pointers on a Pixi container into drags and zooms, such as for
 * moving a camera round a 3D scene. One finger or the mouse drags. Two
 * fingers pinch, and how far apart they are carries the zoom. A third
 * finger is ignored. The wheel zooms too, and so does a trackpad's pinch,
 * which the browser reports as the wheel. The entry host keeps that pinch
 * from zooming the page.
 *
 * A gesture starts with a press on the target, and follows its pointers
 * wherever they go on the stage, so a drag doesn't end as it slips off. A
 * press on something drawn over the target, such as a slider, goes to that
 * instead, and starts nothing here. The wheel zooms only over the target.
 *
 * Every report comes from the browser's own events, so each fires between
 * frames. A pointer the browser cancels, or one held as the window loses
 * focus, ends the gesture. Pixi passes neither on, so this listens for them
 * on the window. The listeners are removed when the container is destroyed.
 */
export function listenToDragZoom(options: DragZoomOptions): void {
    const { target, onDragged, onZoomed, onGestureBegan, onGestureEnded } = options;
    target.eventMode = 'static';
    // Where each pointer held down was last seen
    const held = new Map<number, Point>();
    const point = new Point();
    // How far apart the two fingers of a pinch were last seen, or 0 when there aren't two
    let pinchDistance = 0;

    target.on('pointerdown', (e: FederatedPointerEvent) => {
        if (held.size >= 2) return;
        if (held.size === 0) onGestureBegan?.();
        const { x, y } = e.getLocalPosition(target, point);
        held.set(e.pointerId, new Point(x, y));
        if (held.size === 2) pinchDistance = measurePinch();
    });
    target.on('globalpointermove', (e: FederatedPointerEvent) => {
        const last = held.get(e.pointerId);
        if (last === undefined) return;
        const { x, y } = e.getLocalPosition(target, point);
        const deltaX = x - last.x;
        const deltaY = y - last.y;
        last.set(x, y);
        if (held.size === 1) {
            onDragged?.(deltaX, deltaY);
            return;
        }
        const distance = measurePinch();
        if (pinchDistance > 0 && distance > 0) onZoomed?.(distance / pinchDistance);
        pinchDistance = distance;
    });
    target.on('pointerup', release);
    target.on('pointerupoutside', release);
    target.on('wheel', (e: FederatedWheelEvent) => {
        const pixels = e.deltaY * (e.deltaMode === LINE_MODE ? PIXELS_PER_LINE : 1);
        onZoomed?.(Math.exp(-pixels * ZOOM_PER_WHEEL_PIXEL));
    });

    if (typeof window === 'undefined') return;
    const onCancel = (e: PointerEvent): void => {
        if (held.has(e.pointerId)) releaseAll();
    };
    // Captured, so an element that stops the cancel on its way up can't hide it
    window.addEventListener('pointercancel', onCancel, true);
    window.addEventListener('blur', releaseAll);
    target.once('destroyed', () => {
        window.removeEventListener('pointercancel', onCancel, true);
        window.removeEventListener('blur', releaseAll);
    });

    function release(e: FederatedPointerEvent): void {
        if (!held.delete(e.pointerId)) return;
        // The finger left behind drags on from where it is, without a jump
        pinchDistance = 0;
        if (held.size === 0) onGestureEnded?.();
    }

    function releaseAll(): void {
        if (held.size === 0) return;
        held.clear();
        pinchDistance = 0;
        onGestureEnded?.();
    }

    /** How far apart the two fingers held are. */
    function measurePinch(): number {
        let first: Point | undefined;
        for (const p of held.values()) {
            if (first === undefined) first = p;
            else return Math.hypot(p.x - first.x, p.y - first.y);
        }
        return 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The wheel event's `deltaMode` for a wheel that counts in lines, not pixels. */
const LINE_MODE = 1;

/** How many pixels a wheel that counts in lines moves for each line. */
const PIXELS_PER_LINE = 16;

/** How much each pixel of the wheel zooms, as a power of e. A notch of about 100 pixels zooms by about a fifth. */
const ZOOM_PER_WHEEL_PIXEL = 0.002;
