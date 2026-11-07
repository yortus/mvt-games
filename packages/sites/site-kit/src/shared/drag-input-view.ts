import { Container, Rectangle } from 'pixi.js';
import { listenToPointer } from './listen-to-pointer';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DragInputViewBindings {
    /** Whether it listens at all, as on a touch screen. Read once. */
    isEnabled: boolean;
    /** The area it listens over, in its own pixels, read once. */
    x: number;
    y: number;
    width: number;
    height: number;
    /**
     * Where the thing dragged is, such as a ship, in the view's pixels. Read
     * as each finger touches down. Without them, it is dragged from (0, 0).
     */
    fromX?: () => number;
    fromY?: () => number;
    /** How far the thing can be dragged, in the view's pixels. Read once. Without them, as far as the finger goes. */
    minX?: number;
    maxX?: number;
    minY?: number;
    maxY?: number;
    /** How many times as far as the finger slides the thing is dragged, so a short slide goes further. 1 by default. Read once. */
    gain?: number;
    /** The player touched down, anywhere over the area. */
    onTouched?: () => void;
    /** The player dragged the thing to (`x`, `y`), in the view's pixels. */
    onDragged?: (x: number, y: number) => void;
    /** The player let go. */
    onLifted?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A finger held and dragged anywhere over an area, for steering on a touch
 * screen. The thing dragged moves as the finger moves, from wherever it was
 * when the finger touched down, so the finger never covers it. A finger that
 * drags it against its limits drags it from there, so it turns back as soon
 * as the finger does. A game that only needs a finger held can listen for
 * that alone, with `onTouched` and `onLifted`. It draws nothing, and relays
 * what it sees as it happens.
 */
export function DragInputView(bindings: DragInputViewBindings): Container {
    const {
        isEnabled, fromX, fromY, minX = -Infinity, maxX = Infinity, minY = -Infinity, maxY = Infinity, gain = 1,
        onTouched, onDragged, onLifted,
    } = bindings;
    const view = new Container();
    view.label = 'drag-input';
    if (!isEnabled) return view;

    view.hitArea = new Rectangle(bindings.x, bindings.y, bindings.width, bindings.height);

    // Where the finger touched down, and where the thing would be with the finger back there
    let startX = 0;
    let startY = 0;
    let anchorX = 0;
    let anchorY = 0;

    listenToPointer({
        target: view,
        onPressed(x, y) {
            startX = x;
            startY = y;
            anchorX = fromX?.() ?? 0;
            anchorY = fromY?.() ?? 0;
            onTouched?.();
        },
        onMoved(x, y) {
            // Past a limit, the finger drags from the limit
            const slidX = (x - startX) * gain;
            const slidY = (y - startY) * gain;
            const toX = Math.max(minX, Math.min(maxX, anchorX + slidX));
            const toY = Math.max(minY, Math.min(maxY, anchorY + slidY));
            anchorX = toX - slidX;
            anchorY = toY - slidY;
            onDragged?.(toX, toY);
        },
        onReleased: () => onLifted?.(),
    });

    return view;
}
