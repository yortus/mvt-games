// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { listenToElementPanZoom, TAP_MAX_MS, TAP_SLOP } from './listen-to-element-pan-zoom';

const ZOOM_PER_WHEEL_NOTCH = 1.25;
const ZOOM_PER_DOUBLE_TAP = 2.5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
    const element = document.createElement('div');
    document.body.replaceChildren(element);
    const calls: string[] = [];
    const drags: [number, number][] = [];
    const zooms: [number, number, number][] = [];
    const turns: [number, number, number][] = [];
    const taps: [number, number][] = [];
    const stop = listenToElementPanZoom({
        element,
        zoomPerWheelNotch: ZOOM_PER_WHEEL_NOTCH,
        zoomPerDoubleTap: ZOOM_PER_DOUBLE_TAP,
        onGestureBegan: () => calls.push('began'),
        onGestureEnded: () => calls.push('ended'),
        onDragged: (x, y) => drags.push([x, y]),
        onZoomed: (factor, x, y) => zooms.push([factor, x, y]),
        onTurned: (angle, x, y) => turns.push([angle, x, y]),
        onTapped: (x, y) => taps.push([x, y]),
    });
    /** Sends a pointer event. A time, in milliseconds, takes the place of the event's own time stamp. */
    const pointer = (kind: string, id: number, x: number, y: number, extra: PointerEventInit = {}, atMs?: number): void => {
        const event = new PointerEvent(kind, {
            pointerId: id, ...at(x, y), pointerType: 'touch', button: 0, bubbles: true, cancelable: true, ...extra,
        });
        if (atMs !== undefined) Object.defineProperty(event, 'timeStamp', { value: atMs });
        element.dispatchEvent(event);
    };
    /** A tap: down and up at one spot, at `atMs`. */
    const tap = (x: number, y: number, atMs: number, pointerType = 'touch'): void => {
        pointer('pointerdown', 9, x, y, { pointerType }, atMs);
        pointer('pointerup', 9, x, y, { pointerType }, atMs + TAP_MAX_MS / 6);
    };
    return { element, stop, calls, drags, zooms, turns, taps, pointer, tap };
}

/**
 * A point on the element, as an event gives it. The element sits at the page's top left, untransformed, so
 * the point is the same on the screen and on the element. The DOM's types leave out `offsetX`, which happy-dom reads.
 */
function at(x: number, y: number): MouseEventInit {
    return { clientX: x, clientY: y, offsetX: x, offsetY: y } as MouseEventInit;
}

/** The sum of the drags reported, as one. */
function totalOf(drags: readonly [number, number][]): [number, number] {
    let x = 0;
    let y = 0;
    for (const [dx, dy] of drags) {
        x += dx;
        y += dy;
    }
    return [x, y];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('listenToElementPanZoom', () => {
    it('drags with one finger, as one gesture, which is no tap', () => {
        const t = setup();
        t.pointer('pointerdown', 1, 100, 100);
        t.pointer('pointermove', 1, 110, 95);
        t.pointer('pointermove', 1, 130, 90);
        t.pointer('pointerup', 1, 130, 90);

        expect(t.calls).toEqual(['began', 'ended']);
        expect(t.drags).toEqual([[10, -5], [20, -5]]);
        expect(t.zooms).toEqual([]);
        expect(t.taps).toEqual([]);
    });

    it('measures on the element, not the screen, so an element drawn at another scale reports in its own pixels', () => {
        // The element shows at a quarter of its size, 200 pixels in from the screen's left, as a box laid over a
        // 3D scene might. The browser's offsetX is on the element, which the reports follow
        const t = setup();
        const on = (x: number, y: number): MouseEventInit => ({ clientX: 200 + x / 4, clientY: y / 4, offsetX: x, offsetY: y } as MouseEventInit);
        t.pointer('pointerdown', 1, 0, 0, on(400, 400));
        t.pointer('pointermove', 1, 0, 0, on(480, 400));
        t.pointer('pointerup', 1, 0, 0, on(480, 400));
        // happy-dom's wheel events leave out offsetX, which a browser's have
        const wheel = new WheelEvent('wheel', { deltaY: -100, cancelable: true, ...on(600, 320) });
        Object.defineProperty(wheel, 'offsetX', { value: 600 });
        Object.defineProperty(wheel, 'offsetY', { value: 320 });
        t.element.dispatchEvent(wheel);

        expect(t.drags).toEqual([[80, 0]]);
        expect(t.zooms).toEqual([[ZOOM_PER_WHEEL_NOTCH, 600, 320]]);
    });

    it('zooms about the middle of two fingers as they spread', () => {
        const t = setup();
        t.pointer('pointerdown', 1, 100, 100);
        t.pointer('pointerdown', 2, 200, 100);
        // The second finger moves out, doubling the spread
        t.pointer('pointermove', 2, 300, 100);

        expect(t.zooms.length).toBe(1);
        const [factor, x, y] = t.zooms[0];
        expect(factor).toBeCloseTo(2);
        expect(x).toBe(200);
        expect(y).toBe(100);
        // The middle moved right by 50
        expect(totalOf(t.drags)).toEqual([50, 0]);
        expect(t.calls).toEqual(['began']);
    });

    it('reports two fingers twisting as a turn about their middle', () => {
        const t = setup();
        t.pointer('pointerdown', 1, 100, 100);
        t.pointer('pointerdown', 2, 200, 100);
        // The first finger swings a quarter turn round the second, clockwise on the screen
        t.pointer('pointermove', 1, 200, 0);
        const [angle] = t.turns[0];
        expect(angle).toBeCloseTo(Math.PI / 2);
    });

    it('never spins a whole turn as two fingers pass the left of each other', () => {
        const t = setup();
        t.pointer('pointerdown', 1, 100, 101);
        t.pointer('pointerdown', 2, 200, 100);
        t.pointer('pointermove', 1, 100, 99);
        const [angle] = t.turns[0];
        expect(Math.abs(angle)).toBeLessThan(0.1);
    });

    it('drags with whichever finger is left when one of a pinch lifts', () => {
        const t = setup();
        t.pointer('pointerdown', 1, 100, 100);
        t.pointer('pointerdown', 2, 200, 100);
        t.pointer('pointerup', 1, 100, 100);
        t.pointer('pointermove', 2, 210, 120);
        t.pointer('pointerup', 2, 210, 120);

        expect(t.drags).toEqual([[10, 20]]);
        expect(t.calls).toEqual(['began', 'ended']);
    });

    it('leaves the mouse\'s other buttons alone', () => {
        const t = setup();
        t.pointer('pointerdown', 1, 100, 100, { pointerType: 'mouse', button: 2 });
        t.pointer('pointermove', 1, 150, 100, { pointerType: 'mouse', button: 2 });

        expect(t.calls).toEqual([]);
        expect(t.drags).toEqual([]);
    });

    // The test page's wheel events carry no pointer position, so only the
    // factor is checked here. The double tap checks the zoom's centre.
    it('zooms in a notch for each turn of the wheel', () => {
        const t = setup();
        t.element.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ...at(40, 30), cancelable: true }));
        t.element.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, ...at(40, 30), cancelable: true }));

        expect(t.zooms[0][0]).toBeCloseTo(ZOOM_PER_WHEEL_NOTCH);
        expect(t.zooms[1][0]).toBeCloseTo(ZOOM_PER_WHEEL_NOTCH ** -3);
    });

    it('stops the wheel scrolling the page', () => {
        const t = setup();
        const event = new WheelEvent('wheel', { deltaY: 100, cancelable: true });
        t.element.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
    });

    it('reports a tap where it landed, and a click of the mouse as a tap', () => {
        const t = setup();
        t.tap(40, 60, 0);
        t.tap(80, 20, 1000, 'mouse');
        expect(t.taps).toEqual([[40, 60], [80, 20]]);
    });

    it('takes neither a long press nor a slide for a tap', () => {
        const t = setup();
        t.pointer('pointerdown', 1, 40, 60, {}, 0);
        t.pointer('pointerup', 1, 40, 60, {}, TAP_MAX_MS * 2);
        t.pointer('pointerdown', 1, 40, 60, {}, TAP_MAX_MS * 3);
        t.pointer('pointermove', 1, 40 + TAP_SLOP * 2, 60, {}, TAP_MAX_MS * 3);
        t.pointer('pointerup', 1, 40 + TAP_SLOP * 2, 60, {}, TAP_MAX_MS * 3 + 10);
        expect(t.taps).toEqual([]);
    });

    it('zooms in on a double click', () => {
        const t = setup();
        t.tap(12, 34, 0, 'mouse');
        t.element.dispatchEvent(new MouseEvent('dblclick', at(12, 34)));

        expect(t.zooms).toEqual([[ZOOM_PER_DOUBLE_TAP, 12, 34]]);
    });

    it('zooms in on a double tap, once, whether or not the browser adds a double click, as well as reporting each tap', () => {
        const t = setup();
        t.tap(50, 60, 0);
        t.tap(52, 61, 200);
        t.element.dispatchEvent(new MouseEvent('dblclick', at(52, 61)));

        expect(t.taps.length).toBe(2);
        expect(t.zooms).toEqual([[ZOOM_PER_DOUBLE_TAP, 52, 61]]);
    });

    it('takes taps too far apart in time or place as two taps', () => {
        const t = setup();
        t.tap(50, 60, 0);
        t.tap(50, 60, 1000);
        t.tap(200, 60, 1100);

        expect(t.zooms).toEqual([]);
    });

    it('takes a drag as no tap', () => {
        const t = setup();
        t.tap(50, 60, 0);
        t.pointer('pointerdown', 9, 50, 60, {}, 100);
        t.pointer('pointermove', 9, 90, 60, {}, 120);
        t.pointer('pointerup', 9, 90, 60, {}, 140);

        expect(t.zooms).toEqual([]);
    });

    it('ignores a third finger until one of the pinch lifts', () => {
        const t = setup();
        t.pointer('pointerdown', 1, 100, 100);
        t.pointer('pointerdown', 2, 200, 100);
        t.pointer('pointerdown', 3, 300, 300);
        t.pointer('pointermove', 3, 400, 400);

        expect(t.drags).toEqual([]);
        expect(t.zooms).toEqual([]);

        // The third takes the first's place, from where it now is
        t.pointer('pointerup', 1, 100, 100);
        t.pointer('pointermove', 3, 400, 500);
        expect(t.zooms.length).toBe(1);
    });

    it('ends the gesture when the pointer capture is lost', () => {
        const t = setup();
        t.pointer('pointerdown', 1, 100, 100);
        t.pointer('lostpointercapture', 1, 100, 100);
        t.pointer('pointerup', 1, 100, 100);

        expect(t.calls).toEqual(['began', 'ended']);
    });

    it('stops watching when stopped', () => {
        const t = setup();
        t.stop();
        t.pointer('pointerdown', 1, 100, 100);
        t.pointer('pointermove', 1, 120, 100);

        expect(t.calls).toEqual([]);
        expect(t.drags).toEqual([]);
    });
});
