/** @jsxImportSource @mvtjs/html */
import { PerfmonView } from '@mvtjs/html';
import type { MetricKind, PerformanceMetrics } from '@mvtjs/utils';

// The meter goes with the panel, so the page loads it with the panel, the
// first time the Perfmon opens (`loadPerfmon`), and its first load holds neither
export { createPerformanceMeter } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the floating Perfmon shows. */
export interface PerfmonFloatViewBindings {
    /** Whether the Perfmon is open. */
    readonly isOpen: () => boolean;
    /** How fast the page runs, or undefined while there is nothing to show. */
    readonly metrics: () => PerformanceMetrics | undefined;
    /** The metrics that can't be measured as things stand, shown as n/a. */
    readonly unmeasured: () => readonly MetricKind[];
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The Perfmon, in a panel with a title bar, floating over the page. It first
 * drops from the right end of the nav. The visitor can drag it from anywhere
 * on it but its buttons, with a mouse or a finger, anywhere in the window
 * below the nav, and it stays where they leave it, kept in view as the window
 * changes size. It sits under the nav, and the runner's bar, so their menus
 * drop in front of it.
 * The explanation's text is left to scroll, rather than drag. The gauge in the
 * nav, or in the runner's bar, opens and closes it.
 */
export function PerfmonFloatView(bindings: PerfmonFloatViewBindings): Element {
    // Presentation state: where the visitor has dragged the panel, its left
    // and top in the viewport, in CSS pixels. Undefined until the first drag,
    // while it sits where it first drops
    let x: number | undefined;
    let y = 0;
    let drag: Drag | undefined;
    let root: HTMLElement | undefined;
    let drawnX: number | undefined;
    let drawnY = 0;
    let isDragDrawn = false;
    window.addEventListener('resize', keepInView);

    const panel = PerfmonView({ metrics: bindings.metrics, unmeasured: bindings.unmeasured, title: 'Performance', infoNote: NOTE });

    return (
        <div
            class="perfmon-float"
            visible={bindings.isOpen}
            ref={(e) => {
                root = e;
                // However the drag ends, even where its pointerup never arrives, it lets go of the pointer
                e.addEventListener('lostpointercapture', endDrag);
            }}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onRefresh={place}
            onDestroyed={() => window.removeEventListener('resize', keepInView)}
        >
            {panel}
        </div>
    );

    /** Writes where the panel was dragged to, once it has been, and whether it is being dragged now. */
    function place(e: HTMLElement): void {
        const isDragging = drag !== undefined;
        if (isDragging !== isDragDrawn) {
            isDragDrawn = isDragging;
            e.classList.toggle('is-dragging', isDragging);
        }
        if (x === undefined || (x === drawnX && y === drawnY)) return;
        if (drawnX === undefined) e.classList.add('is-moved');
        drawnX = x;
        drawnY = y;
        e.style.left = `${x}px`;
        e.style.top = `${y}px`;
    }

    /** A press anywhere on the panel starts a drag, but on a button, or on the explanation's text, which scrolls. */
    function startDrag(e: PointerEvent): void {
        if (root === undefined || drag !== undefined || e.button !== 0 || !(e.target instanceof Element)) return;
        if (e.target.closest('button') !== null || e.target.closest('.mvt-perfmon-info-body') !== null) return;
        e.preventDefault();
        root.setPointerCapture(e.pointerId);
        const { left, top } = placeOf(root);
        drag = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, fromX: left, fromY: top };
    }

    function moveDrag(e: PointerEvent): void {
        if (drag === undefined || e.pointerId !== drag.pointerId) return;
        x = drag.fromX + e.clientX - drag.startX;
        y = drag.fromY + e.clientY - drag.startY;
        keepInView();
    }

    function endDrag(e: PointerEvent): void {
        if (drag === undefined || e.pointerId !== drag.pointerId) return;
        drag = undefined;
    }

    /**
     * Moves the panel, once dragged, back inside the window wherever it would
     * stand out of it. Its box is measured where it shows now, then moved to
     * `x` and `y`. A panel turned with the runner has a box of another shape
     * from its left and top, which this measures too.
     */
    function keepInView(): void {
        if (root === undefined || x === undefined || !bindings.isOpen()) return;
        const box = root.getBoundingClientRect();
        const shown = placeOf(root);
        const dx = x - shown.left;
        const dy = y - shown.top;
        const page = document.documentElement;
        const navHeight = parseFloat(getComputedStyle(page).getPropertyValue('--site-nav-height')) || 0;
        x += shiftInto(box.left + dx, box.right + dx, 0, page.clientWidth);
        y += shiftInto(box.top + dy, box.bottom + dy, navHeight, page.clientHeight);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A drag in progress: the pointer making it, where it was pressed, and where the panel was then. */
interface Drag {
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    readonly fromX: number;
    readonly fromY: number;
}

/** What the explanation says first, about the panel itself. */
const NOTE = 'Drag this panel to move it. To close it, press the gauge at the top of the page.';

/**
 * How far to move a span from `start` to `end` to bring it inside `min` to
 * `max`. A span longer than that keeps its start inside.
 */
function shiftInto(start: number, end: number, min: number, max: number): number {
    if (end > max) return Math.max(max - end, min - start);
    return start < min ? min - start : 0;
}

/** Where the panel is placed: its left and top, as the stylesheet or a drag put them. */
function placeOf(e: HTMLElement): { readonly left: number; readonly top: number } {
    const style = getComputedStyle(e);
    return { left: parseFloat(style.left), top: parseFloat(style.top) };
}
