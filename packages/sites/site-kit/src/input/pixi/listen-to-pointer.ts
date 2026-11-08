import { type Container, type FederatedPointerEvent, Point } from 'pixi.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What to follow, and where to report. Every position is in the target's own pixels. */
export interface PointerOptions {
    /** The container a press must land on. It takes pointer events from now on. */
    readonly target: Container;
    /** A finger, or a mouse button, went down on the target, with no other being followed. */
    readonly onPressed?: (x: number, y: number) => void;
    /** The pointer followed moved, anywhere on the stage, not only over the target. */
    readonly onMoved?: (x: number, y: number) => void;
    /** The pointer followed was let go, over the target or not. */
    readonly onReleased?: (x: number, y: number) => void;
    /**
     * The browser took the pointer followed away, as a phone does when its
     * own gesture begins. Without it, a cancel counts as letting go.
     */
    readonly onCancelled?: () => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Follows one pointer at a time over a Pixi container: a finger, or the
 * mouse, from a press on the container until it lets go. A second finger
 * that touches down meanwhile is ignored, so it can't take the drag over.
 * It only reports. What a press or a drag means is up to whoever calls it.
 *
 * The listeners go when the container is destroyed.
 */
export function listenToPointer(options: PointerOptions): void {
    const { target, onPressed, onMoved, onReleased, onCancelled } = options;
    target.eventMode = 'static';
    // The pointer followed, and a point to measure it into
    let pointerId: number | undefined;
    const point = new Point();

    target.on('pointerdown', (e: FederatedPointerEvent) => {
        if (pointerId !== undefined) return;
        pointerId = e.pointerId;
        const { x, y } = e.getLocalPosition(target, point);
        onPressed?.(x, y);
    });
    // Followed wherever it goes, not only over the target
    target.on('globalpointermove', (e: FederatedPointerEvent) => {
        if (e.pointerId !== pointerId) return;
        const { x, y } = e.getLocalPosition(target, point);
        onMoved?.(x, y);
    });
    target.on('pointerup', release);
    target.on('pointerupoutside', release);
    target.on('pointercancel', (e: FederatedPointerEvent) => {
        if (e.pointerId !== pointerId) return;
        if (onCancelled === undefined) {
            release(e);
            return;
        }
        pointerId = undefined;
        onCancelled();
    });

    function release(e: FederatedPointerEvent): void {
        if (e.pointerId !== pointerId) return;
        pointerId = undefined;
        const { x, y } = e.getLocalPosition(target, point);
        onReleased?.(x, y);
    }
}
