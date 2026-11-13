// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Turns one pointer over the picture into swaps. Positions are in tile
 * edges, from the picture's middle, so a test plays it directly.
 *
 * There are two ways to swap. Drag a piece onto another it can swap with,
 * and let go. Or tap a piece, which picks it up, then tap another. Tapping
 * a piece it can't swap with picks that one up instead. Tapping the piece
 * picked up again, or anywhere off the pieces that can move, puts it down.
 * A locked piece can't be dragged, picked up or swapped with.
 */
export interface SwapGesturesViewModel {
    /** The tile picked up by a tap, waiting for a second, or -1. */
    readonly pickedTile: number;
    /** The tile being dragged, once the pointer has moved far enough to be a drag, or -1. */
    readonly draggedTile: number;
    /** The tile under a drag that it would swap with, or -1. */
    readonly targetTile: number;
    /** Where the pointer is, in tile edges, while a drag goes on. */
    readonly pointerX: number;
    readonly pointerY: number;
    /**
     * A count of the drags that have ended, let go or taken away, and the
     * tile the last one dragged and where it ended, so a view can carry its
     * piece on from there, to the tile it swapped with or back home. The
     * swap, if there is one, is asked for as the count rises.
     */
    readonly dragsEnded: number;
    readonly endedTile: number;
    readonly endedX: number;
    readonly endedY: number;

    press: (x: number, y: number) => void;
    move: (x: number, y: number) => void;
    release: () => void;
    /** The pointer was taken away, as a phone does when its own gesture begins: nothing is swapped. */
    cancel: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SwapGesturesViewModelOptions {
    /** The tile at a point, in tile edges, or -1. */
    readonly tileAt: (x: number, y: number) => number;
    readonly isLockedAt: (tile: number) => boolean;
    /** Whether the pieces on two tiles can swap. */
    readonly canSwap: (a: number, b: number) => boolean;
    /** The player asked to swap the pieces on two tiles. */
    readonly onSwapRequested: (a: number, b: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSwapGesturesViewModel(options: SwapGesturesViewModelOptions): SwapGesturesViewModel {
    const { tileAt, isLockedAt, canSwap, onSwapRequested } = options;
    let pickedTile = -1;
    let pressedTile = -1;
    let draggedTile = -1;
    let targetTile = -1;
    let pressX = 0;
    let pressY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let isPressed = false;
    let dragsEnded = 0;
    let endedTile = -1;
    let endedX = 0;
    let endedY = 0;

    return {
        get pickedTile() { return pickedTile; },
        get draggedTile() { return draggedTile; },
        get targetTile() { return targetTile; },
        get pointerX() { return pointerX; },
        get pointerY() { return pointerY; },
        get dragsEnded() { return dragsEnded; },
        get endedTile() { return endedTile; },
        get endedX() { return endedX; },
        get endedY() { return endedY; },
        press(x, y) {
            isPressed = true;
            const tile = tileAt(x, y);
            pressedTile = tile >= 0 && !isLockedAt(tile) ? tile : -1;
            pressX = x;
            pressY = y;
            pointerX = x;
            pointerY = y;
        },
        move(x, y) {
            if (!isPressed) return;
            pointerX = x;
            pointerY = y;
            if (pressedTile < 0) return;
            if (draggedTile < 0 && Math.hypot(x - pressX, y - pressY) >= DRAG_DISTANCE) {
                draggedTile = pressedTile;
                pickedTile = -1;
            }
            if (draggedTile < 0) return;
            const tile = tileAt(x, y);
            targetTile = tile >= 0 && canSwap(draggedTile, tile) ? tile : -1;
        },
        release() {
            if (!isPressed) return;
            isPressed = false;
            if (draggedTile >= 0) {
                const from = draggedTile;
                const to = targetTile;
                endDrag();
                if (to >= 0) onSwapRequested(from, to);
                return;
            }
            // A tap: pick a piece up, put it down, or swap it with the one picked up
            const tapped = pressedTile;
            pressedTile = -1;
            if (tapped < 0 || tapped === pickedTile) pickedTile = -1;
            else if (pickedTile < 0 || !canSwap(pickedTile, tapped)) pickedTile = tapped;
            else {
                const from = pickedTile;
                pickedTile = -1;
                onSwapRequested(from, tapped);
            }
        },
        cancel() {
            isPressed = false;
            endDrag();
        },
    };

    function endDrag(): void {
        if (draggedTile >= 0) {
            dragsEnded++;
            endedTile = draggedTile;
            endedX = pointerX;
            endedY = pointerY;
        }
        pressedTile = -1;
        draggedTile = -1;
        targetTile = -1;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far a press must move to become a drag, in tile edges. Less is a tap. */
const DRAG_DISTANCE = 0.2;
