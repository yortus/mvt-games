import { Container, Rectangle } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { listenToPointer } from '@mvtjs/site-kit/input/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PaperGesturesViewBindings {
    /** The paper's view, in pixels, which this covers. Its width follows the page, as the paper fits itself to it. */
    readonly width: () => number;
    readonly height: number;
    /** The reader swept a finger, or dragged the mouse, to the left across the paper, as if to turn a page forward. */
    readonly onSwipedLeft: () => void;
    /** The reader swept to the right, as if to turn a page back. */
    readonly onSwipedRight: () => void;
    /** The reader tapped, or clicked, at `x`, `y`, in the view's pixels, without moving. */
    readonly onTapped: (x: number, y: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Turns a sweep across the paper, or a tap on it, into what the reader did.
 * A press that moves far enough sideways is a sweep, reported once, as soon
 * as it's far enough. A press let go where it went down is a tap, but one
 * the browser cancels isn't. It's invisible, and doesn't need an update
 * step. Its refresh only follows the view's width, for the area it covers.
 * Its relays fire from the browser's pointer events, between frames.
 */
export function PaperGesturesView({ width, height, onSwipedLeft, onSwipedRight, onTapped }: PaperGesturesViewBindings): Container {
    const area = new Rectangle(0, 0, width(), height);
    const view = new Container({ label: 'paper-gestures', hitArea: area });
    setRefresh(view, () => {
        area.width = width();
    });
    // Where the press went down, how far it has strayed, and whether it has been reported as a sweep
    let pressX = 0;
    let pressY = 0;
    let farthest = 0;
    let isSwept = false;
    listenToPointer({
        target: view,
        onPressed: (x, y) => {
            pressX = x;
            pressY = y;
            farthest = 0;
            isSwept = false;
        },
        onMoved: (x, y) => {
            farthest = Math.max(farthest, Math.hypot(x - pressX, y - pressY));
            const across = x - pressX;
            if (isSwept || Math.abs(across) < SWIPE_DISTANCE || Math.abs(across) < Math.abs(y - pressY)) return;
            isSwept = true;
            if (across < 0) onSwipedLeft();
            else onSwipedRight();
        },
        onReleased: () => {
            if (!isSwept && farthest < TAP_SLOP) onTapped(pressX, pressY);
        },
        onCancelled: () => {
            isSwept = true;
        },
    });
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far a press moves sideways to be a sweep, and how far it may stray and still be a tap, in the view's pixels. */
const SWIPE_DISTANCE = 50;
const TAP_SLOP = 12;
