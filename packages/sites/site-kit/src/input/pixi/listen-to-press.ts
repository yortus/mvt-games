import type { Container, FederatedPointerEvent } from 'pixi.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A press on a button, followed by `listenToPress`. */
export interface Press {
    /**
     * Whether a pointer is held down on the button, and is still over it. A
     * button's refresh reads it to show the hold. It turns false as the
     * pointer slides off, since letting go there won't press the button.
     */
    readonly isHeld: boolean;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PressOptions {
    /** The button's container. It takes pointer events from now on. */
    readonly target: Container;
    /**
     * Whether the button works. It is read as the pointer lets go, so a
     * button disabled while it is held doesn't fire. It works by default.
     */
    readonly isEnabled?: () => boolean;
    /** The button was pressed. That is, a pointer went down on it and let go over it. */
    readonly onPressed: () => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Follows presses on a Pixi container, for a button that shows when it is
 * held. A button that shows nothing while held needs only Pixi's own
 * `pointertap`, which fires on a tap too. A press counts when the pointer
 * lets go over the button. So a finger that lands on it by mistake
 * can slide off, and the button doesn't fire. A press the browser cancels
 * doesn't fire either. One pointer is followed at a time, so a second finger
 * can't press the button while the first is down.
 *
 * It reports only from the pointer's own events, so `onPressed` fires
 * between frames. It shows nothing. A button's view reads `isHeld` to show
 * the hold its own way. The listeners go when the container is destroyed,
 * and a press under way then doesn't fire.
 */
export function listenToPress(options: PressOptions): Press {
    const { target, isEnabled, onPressed } = options;
    target.eventMode = 'static';
    // The pointer followed, and whether it is over the button
    let pointerId: number | undefined;
    let isOver = false;

    target.on('pointerdown', (e: FederatedPointerEvent) => {
        if (pointerId !== undefined) return;
        pointerId = e.pointerId;
        isOver = true;
    });
    target.on('pointerover', (e: FederatedPointerEvent) => {
        if (e.pointerId === pointerId) isOver = true;
    });
    target.on('pointerout', (e: FederatedPointerEvent) => {
        if (e.pointerId === pointerId) isOver = false;
    });
    target.on('pointerup', (e: FederatedPointerEvent) => {
        if (e.pointerId !== pointerId) return;
        release();
        if (isEnabled?.() ?? true) onPressed();
    });
    target.on('pointerupoutside', (e: FederatedPointerEvent) => {
        if (e.pointerId === pointerId) release();
    });
    target.on('pointercancel', (e: FederatedPointerEvent) => {
        if (e.pointerId === pointerId) release();
    });

    return {
        get isHeld() {
            return pointerId !== undefined && isOver;
        },
    };

    function release(): void {
        pointerId = undefined;
        isOver = false;
    }
}
