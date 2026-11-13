import { Container, Rectangle } from 'pixi.js';
import { listenToPointer } from './listen-to-pointer';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** The direction a swipe went. */
export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export interface SwipeInputViewBindings {
    /** Whether it listens at all, as on a touch screen. Read once. */
    isEnabled: boolean;
    /** The area it listens over, in its own pixels, read once. */
    x: number;
    y: number;
    width: number;
    height: number;
    /** How far a finger must slide, in the view's pixels, to swipe. Read once. */
    swipeDistance: number;
    /** The player swiped `direction`, the direction the slide mostly went. */
    onSwiped?: (direction: SwipeDirection) => void;
    /** The player tapped, touching and letting go without sliding. */
    onTapped?: () => void;
    /** The player let go, after a swipe or a tap, for a game that steers only while a finger stays down. */
    onLifted?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Reports swipes and taps anywhere over an area, for steering on a touch
 * screen. A finger that slides `swipeDistance` swipes in the direction it
 * slid most. If it keeps sliding, it swipes again each time it turns. So one
 * touch can steer round several corners. A touch let go without sliding is
 * a tap. The view draws nothing. It calls its relays as each swipe or tap
 * happens.
 */
export function SwipeInputView(bindings: SwipeInputViewBindings): Container {
    const { isEnabled, swipeDistance, onSwiped, onTapped, onLifted } = bindings;
    const view = new Container();
    view.label = 'swipe-input';
    if (!isEnabled) return view;

    view.hitArea = new Rectangle(bindings.x, bindings.y, bindings.width, bindings.height);

    // Where the finger touched down
    let startX = 0;
    let startY = 0;
    // Where the finger last swiped from
    let anchorX = 0;
    let anchorY = 0;
    // The direction the finger last swiped
    let swiped: SwipeDirection | undefined;

    listenToPointer({
        target: view,
        onPressed(x, y) {
            startX = anchorX = x;
            startY = anchorY = y;
            swiped = undefined;
        },
        onMoved(x, y) {
            const direction = findDirection(x - anchorX, y - anchorY);
            if (direction === undefined) return;
            anchorX = x;
            anchorY = y;
            if (direction === swiped) return;
            swiped = direction;
            onSwiped?.(direction);
        },
        onReleased(x, y) {
            if (swiped === undefined) {
                // A quick flick may slide its whole way between two moves
                const direction = findDirection(x - startX, y - startY);
                if (direction !== undefined) onSwiped?.(direction);
                else onTapped?.();
            }
            onLifted?.();
        },
    });

    return view;

    /** Returns the direction a slide of (dx, dy) went, if it was far enough to swipe. */
    function findDirection(dx: number, dy: number): SwipeDirection | undefined {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < swipeDistance) return undefined;
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
        return dy > 0 ? 'down' : 'up';
    }
}
