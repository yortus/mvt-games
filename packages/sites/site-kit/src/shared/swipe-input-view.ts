import { Container, Rectangle } from 'pixi.js';
import { listenToPointer } from './listen-to-pointer';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** The way a swipe went. */
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
    /** The player swiped `direction`, the way the slide mostly went. */
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
 * Swipes and taps anywhere over an area, for steering on a touch screen. A
 * finger that slides `swipeDistance` swipes the way it slid most. A finger
 * that keeps sliding swipes again each time it turns, so one touch can steer
 * round several corners. A touch let go without sliding is a tap. It draws
 * nothing, and relays what it sees as it happens.
 */
export function SwipeInputView(bindings: SwipeInputViewBindings): Container {
    const { isEnabled, swipeDistance, onSwiped, onTapped, onLifted } = bindings;
    const view = new Container();
    view.label = 'swipe-input';
    if (!isEnabled) return view;

    view.hitArea = new Rectangle(bindings.x, bindings.y, bindings.width, bindings.height);

    // Where the finger touched down, where it last swiped from, and the way it last swiped
    let startX = 0;
    let startY = 0;
    let anchorX = 0;
    let anchorY = 0;
    let swiped: SwipeDirection | undefined;

    listenToPointer({
        target: view,
        onPressed(x, y) {
            startX = anchorX = x;
            startY = anchorY = y;
            swiped = undefined;
        },
        onMoved(x, y) {
            const way = findWay(x - anchorX, y - anchorY);
            if (way === undefined) return;
            anchorX = x;
            anchorY = y;
            if (way === swiped) return;
            swiped = way;
            onSwiped?.(way);
        },
        onReleased(x, y) {
            if (swiped === undefined) {
                // A quick flick may slide its whole way between two moves
                const way = findWay(x - startX, y - startY);
                if (way !== undefined) onSwiped?.(way);
                else onTapped?.();
            }
            onLifted?.();
        },
    });

    return view;

    /** The way a slide of (dx, dy) went, if it was far enough to swipe. */
    function findWay(dx: number, dy: number): SwipeDirection | undefined {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < swipeDistance) return undefined;
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
        return dy > 0 ? 'down' : 'up';
    }
}
