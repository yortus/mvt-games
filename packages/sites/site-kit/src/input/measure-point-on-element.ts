// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A point on an element, in its own CSS pixels, from its top left. */
export interface ElementPoint {
    x: number;
    y: number;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Writes where a pointer event landed on `element` into `out`, in the
 * element's own CSS pixels, from its top left, as if it had no CSS
 * transform.
 *
 * Taking the element's box away from `clientX` works only while every
 * element on the way to it is untransformed. On a page turned a quarter
 * turn, or in a box of HTML laid over a 3D scene, a zoom would land away
 * from the pointer. A drag would run too slow or too fast. The browser
 * works out the event's `offsetX` back through every transform, 3D ones
 * included, so this starts from that.
 *
 * `offsetX` is measured from the event's target. For a target inside the
 * element, the target's place in the element is added, from the layout,
 * which is right as long as nothing between the two is transformed. If the
 * target's offset parents never reach the element, it falls back to the
 * boxes on the screen.
 */
export function measurePointOnElement(event: MouseEvent, element: HTMLElement, out: ElementPoint): void {
    let x = event.offsetX;
    let y = event.offsetY;
    let node = event.target;
    while (node !== element) {
        if (!(node instanceof HTMLElement) || node.offsetParent === null) {
            const bounds = element.getBoundingClientRect();
            out.x = event.clientX - bounds.left;
            out.y = event.clientY - bounds.top;
            return;
        }
        x += node.offsetLeft;
        y += node.offsetTop;
        node = node.offsetParent;
    }
    out.x = x;
    out.y = y;
}
