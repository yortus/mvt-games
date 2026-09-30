import { type Camera, type Intersection, type Object3D, Raycaster, Vector2 } from 'three';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The pointer events the picker dispatches on three.js objects. */
export type PointerPickEventKind = 'click' | 'pointerdown' | 'pointerup' | 'pointermove' | 'pointerover' | 'pointerout';

/**
 * A pointer event, dispatched on the object under the pointer and then on each
 * of its ancestors in turn, as DOM pointer events bubble.
 */
export interface PointerPickEvent {
    readonly type: PointerPickEventKind;
    /** The object under the pointer: the nearest visible one the ray hit, or for `pointerout`, the one it left. */
    readonly object: Object3D;
    /** Where the ray hit `object`, or `undefined` for `pointerout`. */
    readonly intersection: Intersection | undefined;
    /** The DOM event that caused it. */
    readonly nativeEvent: PointerLike;
    /** Stops the event reaching the rest of `object`'s ancestors. */
    readonly stopPropagation: () => void;
}

/** What the picker reads from a DOM pointer event. */
export interface PointerLike {
    readonly clientX: number;
    readonly clientY: number;
}

/** What the picker needs of the element the scene is drawn in: a canvas, usually. */
export interface PointerEventSource {
    addEventListener: (type: string, listener: (event: PointerLike) => void) => void;
    removeEventListener: (type: string, listener: (event: PointerLike) => void) => void;
    getBoundingClientRect: () => { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
}

export interface PointerPickerOptions {
    /** The element the scene is drawn in, which receives the pointer events. */
    readonly domElement: PointerEventSource;
    /** The camera the scene is drawn with, read on each event. */
    readonly camera: () => Camera;
    /** The objects to pick among: usually the scene. */
    readonly scene: Object3D;
}

export interface PointerPicker {
    /** Removes the picker's listeners from the element. */
    dispose: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Raycasts the pointer into the scene on each DOM pointer event, and
 * dispatches the matching {@link PointerPickEvent} on the nearest visible
 * object under it, then on each of its ancestors, so an `onClick` attribute
 * on a group hears clicks on any mesh inside it. Moving onto and off objects
 * dispatches `pointerover` and `pointerout`.
 *
 * Raycasting uses each object's world matrix as last rendered, which is what
 * the pointer was over.
 */
export function createPointerPicker(options: PointerPickerOptions): PointerPicker {
    const { domElement, camera, scene } = options;
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const hits: Intersection[] = [];
    let hovered: Object3D | undefined;

    const listeners: Record<string, (event: PointerLike) => void> = {
        pointermove: onMove,
        pointerdown: (event) => onButton('pointerdown', event),
        pointerup: (event) => onButton('pointerup', event),
        click: (event) => onButton('click', event),
        pointerleave: (event) => hover(undefined, event),
    };
    for (const type in listeners) domElement.addEventListener(type, listeners[type]);

    return {
        dispose() {
            for (const type in listeners) domElement.removeEventListener(type, listeners[type]);
            hovered = undefined;
        },
    };

    function onMove(event: PointerLike): void {
        const hit = pick(event);
        hover(hit, event);
        if (hit !== undefined) dispatch('pointermove', hit.object, hit, event);
    }

    function onButton(kind: PointerPickEventKind, event: PointerLike): void {
        const hit = pick(event);
        if (hit !== undefined) dispatch(kind, hit.object, hit, event);
    }

    function hover(hit: Intersection | undefined, event: PointerLike): void {
        const object = hit?.object;
        if (object === hovered) return;
        if (hovered !== undefined) dispatch('pointerout', hovered, undefined, event);
        hovered = object;
        if (hit !== undefined) dispatch('pointerover', hit.object, hit, event);
    }

    /** The nearest hit on a visible object, if any. three's raycaster does not check visibility. */
    function pick(event: PointerLike): Intersection | undefined {
        const rect = domElement.getBoundingClientRect();
        pointer.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera());
        hits.length = 0;
        raycaster.intersectObject(scene, true, hits);
        for (let i = 0; i < hits.length; i++) {
            if (isShown(hits[i].object)) return hits[i];
        }
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Dispatches a pick event on `object`, then on each ancestor until a handler stops it. */
function dispatch(type: PointerPickEventKind, object: Object3D, intersection: Intersection | undefined, nativeEvent: PointerLike): void {
    let isStopped = false;
    const event: PointerPickEvent = {
        type,
        object,
        intersection,
        nativeEvent,
        stopPropagation: () => {
            isStopped = true;
        },
    };
    for (let node: Object3D | null = object; node !== null && !isStopped; node = node.parent) {
        node.dispatchEvent(event as never);
    }
}

/** Whether `object` and all its ancestors are visible. */
function isShown(object: Object3D): boolean {
    for (let node: Object3D | null = object; node !== null; node = node.parent) {
        if (!node.visible) return false;
    }
    return true;
}
