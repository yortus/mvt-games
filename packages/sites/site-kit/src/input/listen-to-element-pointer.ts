// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What to follow, and where to report. Every position is in the viewport's CSS pixels, as `clientX` and `clientY` give it. */
export interface ElementPointerOptions {
    /** The element a press must land on. */
    readonly element: HTMLElement;
    /**
     * Whether to follow a press, such as one that didn't land on a button
     * inside the element. Every press of a finger, a pen or the mouse's main
     * button is followed by default.
     */
    readonly isPressFollowed?: (event: PointerEvent) => boolean;
    /** A finger, or the mouse's main button, went down on the element, with no other being followed. */
    readonly onPressed?: (x: number, y: number) => void;
    /** The pointer followed moved, anywhere in the window, not only over the element. */
    readonly onMoved?: (x: number, y: number) => void;
    /** The pointer followed was let go, or the element lost hold of it. */
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
 * Follows one pointer at a time over a DOM element. The pointer is a finger,
 * a pen or the mouse. It is followed from a press on the element until it
 * lets go. The element captures it, so it is followed even off the element.
 * A second finger that touches down meanwhile is ignored, so it can't take
 * the drag over. It prevents the browser's default for a press it follows,
 * such as starting to select text.
 * It only reports. What a press or a drag means is up to whoever calls it.
 *
 * Every report comes from one of the element's own events. A capture lost
 * without a `pointerup`, which can happen for many reasons, counts as letting
 * go. A capture can also be lost because of our own code, as when a refresh
 * removes the element. So the function it returns stops listening, and
 * reports nothing. A view calls it as its element is destroyed. That removes
 * the listeners before the browser can report the lost capture.
 */
export function listenToElementPointer(options: ElementPointerOptions): () => void {
    const { element, isPressFollowed, onPressed, onMoved, onReleased, onCancelled } = options;
    // The pointer followed, and where it was last seen
    let pointerId: number | undefined;
    let lastX = 0;
    let lastY = 0;

    element.addEventListener('pointerdown', press);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', release);
    element.addEventListener('lostpointercapture', loseCapture);
    element.addEventListener('pointercancel', cancel);

    return () => {
        element.removeEventListener('pointerdown', press);
        element.removeEventListener('pointermove', move);
        element.removeEventListener('pointerup', release);
        element.removeEventListener('lostpointercapture', loseCapture);
        element.removeEventListener('pointercancel', cancel);
        pointerId = undefined;
    };

    function press(event: PointerEvent): void {
        if (pointerId !== undefined) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (isPressFollowed !== undefined && !isPressFollowed(event)) return;
        event.preventDefault();
        pointerId = event.pointerId;
        lastX = event.clientX;
        lastY = event.clientY;
        capture(event.pointerId);
        onPressed?.(lastX, lastY);
    }

    function move(event: PointerEvent): void {
        if (event.pointerId !== pointerId) return;
        lastX = event.clientX;
        lastY = event.clientY;
        onMoved?.(lastX, lastY);
    }

    function release(event: PointerEvent): void {
        if (event.pointerId !== pointerId) return;
        pointerId = undefined;
        onReleased?.(event.clientX, event.clientY);
    }

    /** The capture went without a `pointerup`, so the pointer is let go where it was last seen. */
    function loseCapture(event: PointerEvent): void {
        if (event.pointerId !== pointerId) return;
        pointerId = undefined;
        onReleased?.(lastX, lastY);
    }

    function cancel(event: PointerEvent): void {
        if (event.pointerId !== pointerId) return;
        pointerId = undefined;
        if (onCancelled === undefined) onReleased?.(lastX, lastY);
        else onCancelled();
    }

    function capture(id: number): void {
        try {
            element.setPointerCapture(id);
        }
        catch {
            // The pointer is already gone, or the browser won't capture it.
            // Either way, the events the element sees are enough.
        }
    }
}
