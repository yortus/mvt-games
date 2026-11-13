import type { Container } from 'pixi.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PointerLossOptions {
    /** The container whose pointer is followed. The listeners go when it is destroyed. */
    readonly target: Container;
    /** The id of the pointer followed, or `undefined` while none is. */
    readonly pointerId: () => number | undefined;
    /** The pointer followed was lost: the browser cancelled it, or the window lost focus while it was down. */
    readonly onLost: () => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Reports when a pointer that a Pixi helper follows is lost, so the helper
 * can stop following it. Two things lose a pointer without its release:
 *
 * - The browser cancels it, as a phone does when a notification is pulled
 *   down. Pixi 8 never listens for the DOM's `pointercancel`, so it never
 *   passes one on, and no `pointerup` follows a cancel. So this listens for
 *   it on the window itself.
 * - The window loses focus while the pointer is down, as when the player
 *   switches to another window with the mouse held. Its release then goes
 *   to the other window.
 *
 * It reports from the browser's own events, so `onLost` fires between
 * frames. Outside a page, as in a unit test in Node, there is no window,
 * and it reports nothing.
 */
export function listenToPointerLoss(options: PointerLossOptions): void {
    const { target, pointerId, onLost } = options;
    if (typeof window === 'undefined') return;
    const onCancel = (e: PointerEvent): void => {
        if (e.pointerId === pointerId()) onLost();
    };
    const onBlur = (): void => {
        if (pointerId() !== undefined) onLost();
    };
    // Captured, so an element that stops the cancel on its way up can't hide it
    window.addEventListener('pointercancel', onCancel, true);
    window.addEventListener('blur', onBlur);
    target.once('destroyed', () => {
        window.removeEventListener('pointercancel', onCancel, true);
        window.removeEventListener('blur', onBlur);
    });
}
