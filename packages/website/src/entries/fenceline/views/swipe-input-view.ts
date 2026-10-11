import { Container, type FederatedPointerEvent, Rectangle } from 'pixi.js';
import type { Direction } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SwipeInputViewBindings {
    /** Whether it listens at all, read once: on a touch screen. */
    isEnabled: boolean;
    /** The area it listens over, in its own pixels, read once. */
    x: number;
    y: number;
    width: number;
    height: number;
    /** How far a finger must slide, in the view's pixels, to swipe. Read once. */
    swipeDistance: number;
    /** The player swiped `direction`: up, down, left or right, whichever the slide was mostly. */
    onSwiped?: (direction: Direction) => void;
    /** The player tapped: touched and let go without sliding. */
    onTapped?: () => void;
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
    const { isEnabled, swipeDistance, onSwiped, onTapped } = bindings;
    const view = new Container();
    view.label = 'swipe-input';
    if (!isEnabled) return view;

    view.eventMode = 'static';
    view.hitArea = new Rectangle(bindings.x, bindings.y, bindings.width, bindings.height);

    // The finger followed, where it touched down, where it last swiped from,
    // and the way it last swiped
    let pointerId: number | undefined;
    let startX = 0;
    let startY = 0;
    let anchorX = 0;
    let anchorY = 0;
    let swiped: Direction | undefined;

    view.on('pointerdown', (e: FederatedPointerEvent) => {
        if (pointerId !== undefined) return;
        pointerId = e.pointerId;
        const { x, y } = e.getLocalPosition(view);
        startX = anchorX = x;
        startY = anchorY = y;
        swiped = undefined;
    });

    // Followed wherever the finger goes, not only over this view
    view.on('globalpointermove', (e: FederatedPointerEvent) => {
        if (e.pointerId !== pointerId) return;
        const { x, y } = e.getLocalPosition(view);
        const way = findWay(x - anchorX, y - anchorY);
        if (way === undefined) return;
        anchorX = x;
        anchorY = y;
        if (way === swiped) return;
        swiped = way;
        onSwiped?.(way);
    });

    const release = (e: FederatedPointerEvent): void => {
        if (e.pointerId !== pointerId) return;
        pointerId = undefined;
        if (swiped !== undefined) return;
        // A quick flick may slide its whole way between two moves
        const { x, y } = e.getLocalPosition(view);
        const way = findWay(x - startX, y - startY);
        if (way !== undefined) onSwiped?.(way);
        else onTapped?.();
    };
    view.on('pointerup', release);
    view.on('pointerupoutside', release);
    view.on('pointercancel', release);

    return view;

    /** The way a slide of (dx, dy) went, if it was far enough to swipe. */
    function findWay(dx: number, dy: number): Direction | undefined {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < swipeDistance) return undefined;
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
        return dy > 0 ? 'down' : 'up';
    }
}
