// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What is open, and where to report a press outside it. */
export interface PressOutsideOptions {
    /** Whether anything is open. A press outside does nothing while it isn't. */
    readonly isOpen: () => boolean;
    /** Whether `target` is inside what is open, where a press doesn't close it. */
    readonly isInside: (target: Node) => boolean;
    /** The visitor pressed outside what is open. */
    readonly onPressedOutside: () => void;
    /**
     * Whether to hear the press before anything on the page does, even a
     * press whose own handler stops it going further, as a game's may.
     * Off by default.
     */
    readonly isCapturing?: boolean;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Listens for a press anywhere in the window outside something open, such
 * as a menu or a note, so the view can close it. It reports from the press's
 * own event, so it fires between frames. The function it returns stops it,
 * and reports nothing. A view calls that as it is destroyed.
 */
export function listenToPressOutside(options: PressOutsideOptions): () => void {
    const { isOpen, isInside, onPressedOutside } = options;
    const capture = options.isCapturing ?? false;
    window.addEventListener('pointerdown', press, { capture });
    return () => window.removeEventListener('pointerdown', press, { capture });

    function press(e: PointerEvent): void {
        if (!isOpen()) return;
        if (e.target instanceof Node && isInside(e.target)) return;
        onPressedOutside();
    }
}
