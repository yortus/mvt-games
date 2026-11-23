import { Container, type FederatedPointerEvent, Point, Rectangle } from 'pixi.js';
import { setRefresh, type ValueOrGetter } from '@mvtjs/pixi';
import { listenToPointer } from '#input/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LookDragViewBindings {
    /**
     * What the visitor looks round in, such as the showcase's 3D scene, which
     * this holds. A press on it turns the view, unless something in it stops
     * the press for itself, such as a screen that receives pointer events.
     */
    readonly scene: Container;
    /** The showcase's view, in pixels, which this covers. Its width may change, for a showcase that fits itself to the page. */
    readonly width: ValueOrGetter<number>;
    readonly height: number;
    /** How far a drag of one pixel across the view turns the view, in radians. */
    readonly radiansPerPixel: number;
    /** The visitor dragged sideways, to look right by `radians`, or left for less than 0. */
    readonly onTurned: (radians: number) => void;
    /** The visitor dragged up or down, to look up by `radians`, or down for less than 0. */
    readonly onTilted: (radians: number) => void;
    /**
     * The page's overlay over the view (`PixiStartBase.overlay`), if the
     * showcase lays entries that draw with the DOM on it. A press there with
     * a mouse button other than the primary drags the view round too, and the
     * overlay doesn't show the browser's context menu.
     */
    readonly overlay?: HTMLElement;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Looks round as the visitor drags across a showcase's view, with a mouse or a
 * finger. A drag to the right looks right, and a drag up looks up, as in a
 * game played with a mouse. It holds the scene, and doesn't draw anything.
 * It doesn't need an update step. Its refresh only follows a changing width,
 * for the area it covers. Each press on the scene bubbles up to it, as
 * Pixi's events do. A press that something in the scene stops on its way
 * never arrives. Its relays fire from the browser's pointer events, between
 * frames.
 *
 * The primary button drags only where nothing in the scene stops the
 * press, so over a screen that receives pointer events, the visitor drags
 * with another button, such as the right one. Over an entry that draws with
 * the DOM, on the overlay, that press drags the view round too, and the
 * entry doesn't receive it.
 *
 * A mouse drag locks the pointer until you let the button go, as games do.
 * Pointer Lock is the browser's way to hide the cursor and report only how
 * far the mouse moves. So you can turn as far as you like, and the turn
 * doesn't stop when the cursor reaches the window's edge. A browser that
 * won't lock the pointer still drags, as far as the cursor can go.
 */
export function LookDragView({ scene, width, height, radiansPerPixel, onTurned, onTilted, overlay }: LookDragViewBindings): Container {
    const area = new Rectangle(0, 0, typeof width === 'function' ? width() : width, height);
    const view = new Container({ label: 'look-drag', hitArea: area, children: [scene] });
    if (typeof width === 'function') {
        setRefresh(view, () => {
            area.width = width();
        });
    }
    // Where the pointer was at the last report, in the view's pixels
    let lastX = 0;
    let lastY = 0;
    // The canvas the pointer is locked to, while a mouse drag has it locked
    let lockedTo: Element | undefined;
    // How many of the view's pixels one pixel of the page is, measured as each drag starts
    let pixelsPerMove = 1;
    // Each lock's first move is skipped, since some browsers report a jump in it
    let isFirstMove = false;
    const origin = new Point();
    const step = new Point();

    listenToPointer({
        target: view,
        onPressed: (x, y) => {
            lastX = x;
            lastY = y;
        },
        onMoved: (x, y) => {
            // A locked cursor doesn't move, so the mouse's own moves turn the view instead
            if (!isLocked()) {
                onTurned((x - lastX) * radiansPerPixel);
                onTilted((lastY - y) * radiansPerPixel);
            }
            lastX = x;
            lastY = y;
        },
        onReleased: unlock,
        onCancelled: unlock,
    });
    view.on('pointerdown', lockMouse);
    overlay?.addEventListener('pointerdown', onOverlayPressed, { capture: true });
    overlay?.addEventListener('contextmenu', preventContextMenu);
    view.on('destroyed', () => {
        unlock();
        overlay?.removeEventListener('pointerdown', onOverlayPressed, { capture: true });
        overlay?.removeEventListener('contextmenu', preventContextMenu);
    });
    return view;

    /** Locks the pointer to the canvas for a mouse drag. */
    function lockMouse(e: FederatedPointerEvent): void {
        const canvas = e.nativeEvent.target;
        if (e.pointerType !== 'mouse' || !(canvas instanceof Element)) return;
        lockTo(canvas);
    }

    /**
     * Starts a drag from a press on the overlay with a mouse button other
     * than the primary, over an entry that draws with the DOM. It's caught on
     * its way down, so the entry doesn't receive it.
     */
    function onOverlayPressed(e: PointerEvent): void {
        if (e.pointerType !== 'mouse' || e.button === 0 || overlay === undefined) return;
        e.preventDefault();
        e.stopPropagation();
        lockTo(overlay);
    }

    function preventContextMenu(e: Event): void {
        e.preventDefault();
    }

    /** Locks the pointer to `element` for a mouse drag, which the mouse's own moves then turn. */
    function lockTo(element: Element): void {
        if (!('requestPointerLock' in element) || lockedTo !== undefined) return;
        // Pixi's pixels are the page's, so this measures how the view is scaled on the canvas
        view.toLocal(origin.set(0, 0), undefined, origin);
        view.toLocal(step.set(1, 0), undefined, step);
        pixelsPerMove = step.x - origin.x;
        lockedTo = element;
        isFirstMove = true;
        document.addEventListener('pointermove', onLockedMove);
        // Pixi may not see the release of a locked pointer, so the page's own release unlocks it too
        document.addEventListener('pointerup', unlock);
        // In Chrome, the request is a promise, which rejects if the lock fails, as it does just after Esc ends one
        const request: unknown = element.requestPointerLock();
        if (request instanceof Promise) request.catch(unlock);
    }

    function onLockedMove(e: PointerEvent): void {
        if (!isLocked()) return;
        if (isFirstMove) {
            isFirstMove = false;
            return;
        }
        onTurned(e.movementX * pixelsPerMove * radiansPerPixel);
        onTilted(-e.movementY * pixelsPerMove * radiansPerPixel);
    }

    /** Releases the pointer lock, if a drag took one. */
    function unlock(): void {
        if (lockedTo === undefined) return;
        document.removeEventListener('pointermove', onLockedMove);
        document.removeEventListener('pointerup', unlock);
        if (isLocked()) document.exitPointerLock();
        lockedTo = undefined;
    }

    function isLocked(): boolean {
        return lockedTo !== undefined && document.pointerLockElement === lockedTo;
    }
}
