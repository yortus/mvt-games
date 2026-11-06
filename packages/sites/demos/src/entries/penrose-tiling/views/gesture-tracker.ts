import {
    DOUBLE_TAP_GAP_MS,
    DOUBLE_TAP_SLOP,
    MAX_WHEEL_ZOOM,
    TAP_MAX_MS,
    TAP_SLOP,
    ZOOM_PER_DOUBLE_TAP,
    ZOOM_PER_PINCH_POINT,
    ZOOM_PER_WHEEL_NOTCH,
} from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A tracker turning an element's pointer and wheel events into drags, zooms and turns, until it is destroyed. */
export interface GestureTracker {
    /** Stops listening, and forgets the gesture in progress, if there is one. */
    destroy: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * What to watch, and where to report. Every measurement is in CSS pixels,
 * and every point is measured from the element's top left corner.
 */
export interface GestureTrackerOptions {
    readonly element: HTMLElement;
    /** The element was dragged by `deltaX` and `deltaY`. */
    readonly onDragged?: (deltaX: number, deltaY: number) => void;
    /** The element was zoomed by `factor` about the point (`x`, `y`). Above 1 is closer in. */
    readonly onZoomed?: (factor: number, x: number, y: number) => void;
    /** The element was turned by `angle` radians about the point (`x`, `y`). Positive is clockwise. */
    readonly onTurned?: (angle: number, x: number, y: number) => void;
    /** The element was tapped or clicked at the point (`x`, `y`). */
    readonly onTapped?: (x: number, y: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a tracker that turns an element's pointers into drags, zooms and
 * turns. One finger or the mouse drags. Two fingers drag, pinch and twist
 * together. The wheel and a trackpad pinch zoom about the pointer. A tap or
 * a click is reported where it lands, and a double tap or a double click
 * also zooms in on the spot.
 *
 * Two fingers report a drag, a zoom and a turn at once. The middle of the
 * pair carries the drag. How far apart they are carries the zoom, and the
 * angle between them the turn, both about that middle. So whatever is under
 * the fingers stays under them. A third finger is followed but ignored,
 * until it takes the place of one that lifts.
 */
export function createGestureTracker(options: GestureTrackerOptions): GestureTracker {
    const { element } = options;

    // Where each pointer held down was last seen, in client coordinates.
    const points = new Map<number, { x: number; y: number }>();
    // The two pointers of a pinch, in the order they went down.
    let firstId = -1;
    let secondId = -1;
    // The kind of pointer that last went down, so a mouse's double click is
    // told apart from the one a browser makes of a double tap.
    let lastPointerType = '';

    // The gesture so far, to tell a tap from a drag. Times are the events'
    // own time stamps.
    let gestureStartMs = 0;
    let gestureTravel = 0;
    let isPinch = false;
    // The last tap, for a second tap to pair with.
    let lastTapMs = Number.NEGATIVE_INFINITY;
    let lastTapX = 0;
    let lastTapY = 0;

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerLifted);
    element.addEventListener('pointercancel', onPointerLifted);
    // A pointer whose capture is lost without an up or a cancel would
    // otherwise hold the gesture open for good.
    element.addEventListener('lostpointercapture', onPointerLifted);
    element.addEventListener('dblclick', onDoubleClick);
    // Not passive: a wheel over the view zooms it instead of scrolling the page.
    element.addEventListener('wheel', onWheel, { passive: false });

    return {
        destroy() {
            element.removeEventListener('pointerdown', onPointerDown);
            element.removeEventListener('pointermove', onPointerMove);
            element.removeEventListener('pointerup', onPointerLifted);
            element.removeEventListener('pointercancel', onPointerLifted);
            element.removeEventListener('lostpointercapture', onPointerLifted);
            element.removeEventListener('dblclick', onDoubleClick);
            element.removeEventListener('wheel', onWheel);
            points.clear();
            firstId = -1;
            secondId = -1;
        },
    };

    function onPointerDown(event: PointerEvent): void {
        // The primary mouse button drags. The others are left alone.
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        lastPointerType = event.pointerType;
        capture(event.pointerId);
        points.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (firstId < 0) {
            firstId = event.pointerId;
            gestureStartMs = event.timeStamp;
            gestureTravel = 0;
            isPinch = false;
        }
        else if (secondId < 0) {
            secondId = event.pointerId;
            isPinch = true;
        }
    }

    function onPointerMove(event: PointerEvent): void {
        const point = points.get(event.pointerId);
        if (point === undefined) return;
        const x = event.clientX;
        const y = event.clientY;
        const other = event.pointerId === firstId
            ? points.get(secondId)
            : event.pointerId === secondId ? points.get(firstId) : undefined;

        if (other === undefined) {
            // The only finger down drags. A third finger, waiting, is only
            // followed, so it can take a lifted finger's place.
            if (event.pointerId === firstId) {
                gestureTravel += Math.abs(x - point.x) + Math.abs(y - point.y);
                options.onDragged?.(x - point.x, y - point.y);
            }
            point.x = x;
            point.y = y;
            return;
        }

        // Two fingers. The middle of the pair moves the view, and the change
        // in how far apart they are and which way they lie zooms and turns
        // it about that middle.
        const beforeMiddleX = (point.x + other.x) * 0.5;
        const beforeMiddleY = (point.y + other.y) * 0.5;
        const beforeSpread = Math.hypot(point.x - other.x, point.y - other.y);
        const beforeAngle = Math.atan2(point.y - other.y, point.x - other.x);
        point.x = x;
        point.y = y;
        const afterMiddleX = (x + other.x) * 0.5;
        const afterMiddleY = (y + other.y) * 0.5;
        const afterSpread = Math.hypot(x - other.x, y - other.y);
        const afterAngle = Math.atan2(y - other.y, x - other.x);

        options.onDragged?.(afterMiddleX - beforeMiddleX, afterMiddleY - beforeMiddleY);
        if (beforeSpread > 0 && afterSpread > 0) {
            const bounds = element.getBoundingClientRect();
            const middleX = afterMiddleX - bounds.left;
            const middleY = afterMiddleY - bounds.top;
            options.onZoomed?.(afterSpread / beforeSpread, middleX, middleY);
            options.onTurned?.(wrapAngle(afterAngle - beforeAngle), middleX, middleY);
        }
    }

    function onPointerLifted(event: PointerEvent): void {
        if (!points.delete(event.pointerId)) return;
        if (event.pointerId === firstId) firstId = -1;
        if (event.pointerId === secondId) secondId = -1;
        if (firstId < 0) {
            firstId = secondId;
            secondId = -1;
        }
        // A third finger, waiting, takes the place of the one lifted.
        if (secondId < 0) {
            for (const id of points.keys()) {
                if (id !== firstId) {
                    secondId = id;
                    break;
                }
            }
        }
        if (points.size > 0) return;
        firstId = -1;
        secondId = -1;
        if (event.type === 'pointerup') noteTap(event);
    }

    /**
     * Reports a gesture that was a tap or a click. If it was a finger or a
     * pen, it also zooms in on the second of a double tap. A mouse's double
     * click comes as its own event.
     */
    function noteTap(event: PointerEvent): void {
        const isTap = !isPinch && gestureTravel < TAP_SLOP && event.timeStamp - gestureStartMs < TAP_MAX_MS;
        if (isTap) {
            const tapBounds = element.getBoundingClientRect();
            options.onTapped?.(event.clientX - tapBounds.left, event.clientY - tapBounds.top);
        }
        if (event.pointerType === 'mouse') return;
        if (!isTap) {
            lastTapMs = Number.NEGATIVE_INFINITY;
            return;
        }
        const isSecond = event.timeStamp - lastTapMs < DOUBLE_TAP_GAP_MS
            && Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY) < DOUBLE_TAP_SLOP;
        if (!isSecond) {
            lastTapMs = event.timeStamp;
            lastTapX = event.clientX;
            lastTapY = event.clientY;
            return;
        }
        lastTapMs = Number.NEGATIVE_INFINITY;
        const bounds = element.getBoundingClientRect();
        options.onZoomed?.(ZOOM_PER_DOUBLE_TAP, event.clientX - bounds.left, event.clientY - bounds.top);
    }

    function onDoubleClick(event: MouseEvent): void {
        event.preventDefault();
        // A browser may make a double click of a double tap too, which the
        // taps have already zoomed for.
        if (lastPointerType !== 'mouse') return;
        const bounds = element.getBoundingClientRect();
        options.onZoomed?.(ZOOM_PER_DOUBLE_TAP, event.clientX - bounds.left, event.clientY - bounds.top);
    }

    function onWheel(event: WheelEvent): void {
        event.preventDefault();
        // A trackpad pinch arrives as a wheel event with the control key
        // held, measured in points rather than notches.
        const factor = event.ctrlKey
            ? Math.exp(-event.deltaY * ZOOM_PER_PINCH_POINT)
            : ZOOM_PER_WHEEL_NOTCH ** -countNotches(event);
        const bounds = element.getBoundingClientRect();
        const limited = Math.min(MAX_WHEEL_ZOOM, Math.max(1 / MAX_WHEEL_ZOOM, factor));
        options.onZoomed?.(limited, event.clientX - bounds.left, event.clientY - bounds.top);
    }

    /** Takes the pointer's events even once it leaves the element, so a drag can run off the edge. */
    function capture(pointerId: number): void {
        try {
            element.setPointerCapture(pointerId);
        }
        catch {
            // The pointer is already gone, or the browser will not capture
            // it. Either way, the events the element sees are enough.
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many notches a wheel event turned, whichever unit it came in. */
function countNotches(event: WheelEvent): number {
    if (event.deltaMode === LINE_MODE) return event.deltaY / LINES_PER_NOTCH;
    if (event.deltaMode === PAGE_MODE) return event.deltaY;
    return event.deltaY / PIXELS_PER_NOTCH;
}

/** `angle`, brought round into the range from -pi to pi, so a pair of fingers crossing the left never spins the view. */
function wrapAngle(angle: number): number {
    return angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2));
}

const LINE_MODE = 1;
const PAGE_MODE = 2;
const LINES_PER_NOTCH = 3;
const PIXELS_PER_NOTCH = 100;
