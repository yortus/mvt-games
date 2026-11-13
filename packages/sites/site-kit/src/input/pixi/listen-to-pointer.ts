import { type Container, type FederatedPointerEvent, Point } from 'pixi.js';
import { listenToPointerLoss } from './listen-to-pointer-loss';

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
    /**
     * A pointer moved anywhere on the stage while none is followed. That is
     * a mouse hovering, since a finger moves only while it is down.
     */
    readonly onHovered?: (x: number, y: number) => void;
    /** The pointer followed was let go, over the target or not. */
    readonly onReleased?: (x: number, y: number) => void;
    /**
     * The pointer followed was lost without being let go: the browser
     * cancelled it, the window lost focus while it was down, or its release
     * went missing. Without it, a loss counts as letting go, where the
     * pointer was last.
     */
    readonly onCancelled?: () => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Follows one pointer at a time over a Pixi container. The pointer is a
 * finger or the mouse. It is followed from a press on the container until
 * it lets go. A second finger that touches down meanwhile is ignored, so it
 * can't take the drag over.
 * It only reports. What a press or a drag means is up to whoever calls it.
 *
 * A pointer the browser cancels, or that is down as the window loses focus,
 * is lost, and reported as a cancel (`listenToPointerLoss` says how). If a
 * pointer's release goes missing in some other way, the next press would
 * be taken for a second finger, and ignored, and so would every press
 * after it. So a press by the primary pointer of the kind followed, which
 * the browser marks as the only one of its kind down, ends the one
 * followed, as a cancel, and is followed instead.
 *
 * The listeners go when the container is destroyed.
 */
export function listenToPointer(options: PointerOptions): void {
    const { target, onPressed, onMoved, onHovered, onReleased, onCancelled } = options;
    target.eventMode = 'static';
    // The pointer followed, its kind, where it was last, and a point to measure it into
    let pointerId: number | undefined;
    let pointerType = '';
    let lastX = 0;
    let lastY = 0;
    const point = new Point();

    target.on('pointerdown', (e: FederatedPointerEvent) => {
        if (pointerId !== undefined) {
            // The pointer followed is no longer down, if this one is the only one of its kind that is
            if (e.isPrimary !== true || e.pointerType !== pointerType) return;
            cancel();
        }
        pointerId = e.pointerId;
        pointerType = e.pointerType;
        const { x, y } = e.getLocalPosition(target, point);
        lastX = x;
        lastY = y;
        onPressed?.(x, y);
    });
    // Followed wherever it goes, not only over the target
    target.on('globalpointermove', (e: FederatedPointerEvent) => {
        if (pointerId === undefined) {
            if (onHovered === undefined) return;
            const { x, y } = e.getLocalPosition(target, point);
            onHovered(x, y);
            return;
        }
        if (e.pointerId !== pointerId) return;
        const { x, y } = e.getLocalPosition(target, point);
        lastX = x;
        lastY = y;
        onMoved?.(x, y);
    });
    target.on('pointerup', release);
    target.on('pointerupoutside', release);
    listenToPointerLoss({ target, pointerId: () => pointerId, onLost: cancel });

    function release(e: FederatedPointerEvent): void {
        if (e.pointerId !== pointerId) return;
        pointerId = undefined;
        const { x, y } = e.getLocalPosition(target, point);
        onReleased?.(x, y);
    }

    /** Stops following the pointer, as a cancel, or as letting go where it was last, when nothing listens for a cancel. */
    function cancel(): void {
        pointerId = undefined;
        if (onCancelled === undefined) onReleased?.(lastX, lastY);
        else onCancelled();
    }
}
