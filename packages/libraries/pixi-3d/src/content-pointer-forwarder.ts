import { type Container3D, type Pointer3DEvent, Ray, Vector3 } from '@pixi/3d';
import { type Container, EventBoundary, FederatedPointerEvent } from 'pixi.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Forwards pointer events from a screen in a 3D scene to the 2D content that it shows. */
export interface ContentPointerForwarder {
    /**
     * Sets whether the screen receives pointer events. While it doesn't, a
     * press on the screen passes through to whatever is behind it, such as a
     * view that turns the camera. A drag that has already started on the
     * screen continues until the pointer is released.
     */
    readonly setEnabled: (isEnabled: boolean) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ContentPointerForwarderOptions {
    /** The screen, which is a node in the scene, centred on its own origin and facing +z. */
    readonly screen: Container3D;
    /** The screen's size, in world units. */
    readonly width: number;
    readonly height: number;
    /** The 2D content that the screen shows, drawn upright and filling the screen. */
    readonly content: Container;
    /** The content's size, in its own pixels. */
    readonly contentWidth: number;
    readonly contentHeight: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a forwarder that lets the player use the 2D content on a screen
 * in a 3D scene, with the mouse or a finger, such as a game's buttons on
 * an arcade cabinet's screen. A texture shows the content on the screen. The content isn't in
 * the 2D stage or in the scene, so Pixi's events never reach it.
 *
 * Instead, PixiJS 3D's picking finds a press on the screen in the scene.
 * The forwarder then works out where the pointer's ray meets the screen's
 * plane, which gives the point on the content. A Pixi `EventBoundary` over
 * the content dispatches the event from there, as Pixi's own events system
 * does for the stage. The boundary finds the target under the point, and
 * fires its `pointerdown`, `pointertap`, `globalpointermove` and the rest.
 * So buttons, sliders and drags work as they do on the stage. A press on
 * the screen stops propagating there, so it doesn't reach a view behind the
 * screen, such as one that turns the camera. A drag that starts on the
 * screen is followed, wherever the pointer goes, until the pointer is
 * released.
 *
 * The forwarded events fire from the browser's events, between frames.
 * Content that listens to DOM events, rather than Pixi's, doesn't receive
 * them. The listeners are removed when the screen is destroyed.
 */
export function createContentPointerForwarder(options: ContentPointerForwarderOptions): ContentPointerForwarder {
    const { screen, width, height, content, contentWidth, contentHeight } = options;
    const boundary = new EventBoundary(content);
    // One event object, filled in again for each event, as Pixi's events system does
    const forwarded = new FederatedPointerEvent(boundary);
    const ray = new Ray();
    const far = new Vector3();
    const near = new Vector3();
    const point = new Vector3();
    let isEnabled = false;
    // The id of the pointer pressed on the screen, followed until it's released, and its last position on the content
    let pressedId: number | undefined;
    let lastX = 0;
    let lastY = 0;
    let isHovered = false;

    screen.eventMode = 'none';
    screen.on('pointerdown', onPressed);
    screen.on('pointermove', onHovered);
    screen.on('pointerout', onLeft);
    screen.on('globalpointermove', onDragged);
    screen.on('pointerup', onReleased);
    screen.on('pointerupoutside', onReleased);
    // The screen never receives a release for a press that the browser cancels, or one held as the window
    // loses focus, so the window's events end it. A unit test in Node has no window.
    if (typeof window !== 'undefined') {
        window.addEventListener('pointercancel', onLost, true);
        window.addEventListener('blur', onLost);
        screen.once('destroyed', () => {
            window.removeEventListener('pointercancel', onLost, true);
            window.removeEventListener('blur', onLost);
        });
    }

    return {
        setEnabled(enabled) {
            if (enabled === isEnabled) return;
            isEnabled = enabled;
            if (!isEnabled && isHovered) leave();
            updateEventMode();
        },
    };

    function onPressed(e: Pointer3DEvent): void {
        if (!isEnabled) return;
        // Stopped here, so a view behind the screen, such as one that turns the camera, never receives it
        e.stopPropagation();
        if (pressedId !== undefined || !measure(e)) return;
        pressedId = e.pointerId;
        forward('pointerdown', e);
    }

    /** Forwards a pointer moving over the screen with nothing pressed, such as the mouse hovering over a button. */
    function onHovered(e: Pointer3DEvent): void {
        if (!isEnabled || pressedId !== undefined || !measure(e)) return;
        isHovered = true;
        forward('pointermove', e);
    }

    function onLeft(e: Pointer3DEvent): void {
        if (pressedId !== undefined || !isHovered) return;
        isHovered = false;
        forward('pointerout', e);
    }

    /** Forwards the moves of the pointer pressed on the screen, wherever it goes. */
    function onDragged(e: Pointer3DEvent): void {
        if (e.pointerId !== pressedId) return;
        measure(e);
        forward('pointermove', e);
    }

    function onReleased(e: Pointer3DEvent): void {
        if (e.pointerId !== pressedId) return;
        pressedId = undefined;
        measure(e);
        forward('pointerup', e);
        updateEventMode();
    }

    /**
     * Ends a press that the browser cancelled, or one held as the window lost
     * focus. The content receives a `pointerup` at the last point measured, so
     * a button or slider held there is released, and a hover there ends too.
     */
    function onLost(): void {
        if (pressedId === undefined) return;
        pressedId = undefined;
        forwarded.type = 'pointerup';
        forwarded.buttons = 0;
        boundary.mapEvent(forwarded);
        if (isHovered) leave();
        updateEventMode();
    }

    /** Makes the screen receive pointer events while it's enabled, and while a drag that started on it continues. */
    function updateEventMode(): void {
        screen.eventMode = isEnabled || pressedId !== undefined ? 'static' : 'none';
    }

    /** Sends the content a `pointerout`, so a button that the pointer was over removes its highlight. */
    function leave(): void {
        isHovered = false;
        forwarded.type = 'pointerout';
        boundary.mapEvent(forwarded);
        screen.cursor = 'auto';
    }

    /**
     * Works out where the event's pointer is on the content, from where its
     * ray meets the screen's plane, and writes it to `lastX` and `lastY`.
     * Returns false, and leaves them unchanged, if the ray is parallel to the
     * plane or the screen isn't in a `View3D`.
     */
    function measure(e: Pointer3DEvent): boolean {
        const view3d = screen.view3d;
        if (view3d === null) return false;
        view3d.screenToRay(e.global, ray, true);
        far.set(ray.origin.x + ray.direction.x, ray.origin.y + ray.direction.y, ray.origin.z + ray.direction.z);
        screen.toLocal(ray.origin, undefined, near, true);
        screen.toLocal(far, undefined, point, true);
        const along = near.z - point.z;
        if (Math.abs(along) < 1e-9) return false;
        const t = near.z / along;
        const x = near.x + t * (point.x - near.x);
        const y = near.y + t * (point.y - near.y);
        // The screen is centred on its origin, with y up. The content's origin is its top left, with y down
        lastX = (x / width + 0.5) * contentWidth;
        lastY = (0.5 - y / height) * contentHeight;
        return true;
    }

    /** Dispatches the event to the content, at the point last measured, as Pixi's events system would. */
    function forward(type: string, from: Pointer3DEvent): void {
        const e = forwarded;
        e.type = type;
        e.pointerId = from.pointerId;
        e.pointerType = from.pointerType;
        e.isPrimary = from.isPrimary;
        e.width = from.width;
        e.height = from.height;
        e.pressure = from.pressure;
        e.button = from.button;
        e.buttons = from.buttons;
        e.altKey = from.altKey;
        e.ctrlKey = from.ctrlKey;
        e.metaKey = from.metaKey;
        e.shiftKey = from.shiftKey;
        e.timeStamp = from.timeStamp;
        e.nativeEvent = from.nativeEvent;
        e.global.set(lastX, lastY);
        e.screen.set(lastX, lastY);
        e.client.set(lastX, lastY);
        boundary.mapEvent(e);
        // The content's cursor, such as a pointing hand over a button, shows over the screen
        screen.cursor = boundary.cursor;
    }
}
