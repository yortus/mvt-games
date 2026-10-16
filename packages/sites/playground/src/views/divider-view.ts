import { setRefresh } from '@mvtjs/html';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DividerViewBindings {
    /** `vertical` divides two panes side by side, and moves left and right. `horizontal` divides two panes one above the other. */
    readonly orientation: 'vertical' | 'horizontal';
    /** What the divider divides, for screen readers, such as "Resize the file list". */
    readonly label: string;
    /** Reported as the divider is dragged, or moved with the arrow keys, by this many CSS pixels: right or down is positive. */
    readonly onDragged?: (deltaPx: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A bar between two panes, which the visitor drags to resize them. It holds
 * the pointer while dragged, so a drag carries on wherever the pointer goes.
 * With the focus on it, the arrow keys move it too.
 */
export function DividerView(bindings: DividerViewBindings): Element {
    const isVertical = bindings.orientation === 'vertical';
    const element = document.createElement('div');
    element.className = `divider divider-${bindings.orientation}`;
    element.tabIndex = 0;
    element.setAttribute('role', 'separator');
    element.setAttribute('aria-orientation', bindings.orientation);
    element.setAttribute('aria-label', bindings.label);
    /** Where the pointer was at the last move, while dragging. */
    let lastAt: number | undefined;
    let wasDragging = false;

    element.addEventListener('pointerdown', (event) => {
        element.setPointerCapture(event.pointerId);
        lastAt = isVertical ? event.clientX : event.clientY;
        event.preventDefault();
    });
    element.addEventListener('pointermove', (event) => {
        if (lastAt === undefined) return;
        const at = isVertical ? event.clientX : event.clientY;
        if (at !== lastAt) bindings.onDragged?.(at - lastAt);
        lastAt = at;
    });
    element.addEventListener('pointerup', endDrag);
    element.addEventListener('pointercancel', endDrag);
    element.addEventListener('keydown', (event) => {
        const step = KEY_STEPS[event.key];
        if (step === undefined) return;
        event.preventDefault();
        bindings.onDragged?.(step);
    });

    setRefresh(element, refresh);
    return element;

    function refresh(): void {
        const isDragging = lastAt !== undefined;
        if (isDragging === wasDragging) return;
        wasDragging = isDragging;
        element.classList.toggle('divider-dragging', isDragging);
    }

    function endDrag(): void {
        lastAt = undefined;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far each arrow key moves a divider, in CSS pixels. */
const KEY_STEPS: Readonly<Record<string, number>> = {
    ArrowLeft: -16,
    ArrowUp: -16,
    ArrowRight: 16,
    ArrowDown: 16,
};
