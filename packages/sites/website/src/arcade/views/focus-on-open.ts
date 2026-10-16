// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FocusOnOpenOptions {
    /** Whether the panel is open. */
    readonly isOpen: () => boolean;
    /** The element to focus as it opens, found in the element the step is set on. */
    readonly target: (root: Element) => HTMLElement | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * A refresh step that puts the focus in a panel as it opens, so the keyboard
 * starts there. Set it on an element that is never hidden, so it runs as the
 * panel opens and closes. The panel itself is still hidden as the step runs
 * in the frame it opens (its `visible` is written after its parent's step),
 * and a hidden element takes no focus, so the step tries again each frame
 * until the focus has gone where it should. It focuses without scrolling, so
 * a panel taller than the screen opens at its top, wherever the target is.
 */
export function focusOnOpen(options: FocusOnOpenOptions): (root: Element) => void {
    let wasOpen = false;
    let isPending = false;
    return (root) => {
        const isOpen = options.isOpen();
        if (isOpen !== wasOpen) {
            wasOpen = isOpen;
            isPending = isOpen;
        }
        if (!isPending) return;
        const target = options.target(root);
        target?.focus({ preventScroll: true });
        if (target !== undefined && document.activeElement === target) isPending = false;
    };
}
