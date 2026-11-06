// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createGestureTracker } from './gesture-tracker';
import { TAP_MAX_MS, TAP_SLOP, ZOOM_PER_DOUBLE_TAP } from './view-constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
    const element = document.createElement('div');
    document.body.replaceChildren(element);
    const drags: [number, number][] = [];
    const zooms: [number, number, number][] = [];
    const turns: [number, number, number][] = [];
    const taps: [number, number][] = [];
    createGestureTracker({
        element,
        onDragged: (x, y) => drags.push([x, y]),
        onZoomed: (factor, x, y) => zooms.push([factor, x, y]),
        onTurned: (angle, x, y) => turns.push([angle, x, y]),
        onTapped: (x, y) => taps.push([x, y]),
    });
    /** Sends a pointer event. A time, in milliseconds, takes the place of the event's own time stamp. */
    const pointer = (kind: string, id: number, x: number, y: number, atMs = 0, pointerType = 'touch'): void => {
        const event = new PointerEvent(kind, {
            pointerId: id, clientX: x, clientY: y, pointerType, button: 0, bubbles: true, cancelable: true,
        });
        Object.defineProperty(event, 'timeStamp', { value: atMs });
        element.dispatchEvent(event);
    };
    return { drags, zooms, turns, taps, pointer };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createGestureTracker', () => {
    it('reports a drag by one finger', () => {
        const t = setup();
        t.pointer('pointerdown', 1, 100, 100);
        t.pointer('pointermove', 1, 130, 90);
        t.pointer('pointerup', 1, 130, 90);
        expect(t.drags).toEqual([[30, -10]]);
        expect(t.taps).toEqual([]);
    });

    it('reports two fingers moving together as a drag of their middle', () => {
        const t = setup();
        t.pointer('pointerdown', 1, 100, 100);
        t.pointer('pointerdown', 2, 200, 100);
        t.pointer('pointermove', 1, 110, 100);
        expect(t.drags).toEqual([[5, 0]]);
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

    it('reports a tap where it landed', () => {
        const t = setup();
        t.pointer('pointerdown', 1, 40, 60);
        t.pointer('pointerup', 1, 40, 60, TAP_MAX_MS / 2);
        expect(t.taps).toEqual([[40, 60]]);
    });

    it('reports a click of the mouse as a tap', () => {
        const t = setup();
        t.pointer('pointerdown', 1, 40, 60, 0, 'mouse');
        t.pointer('pointerup', 1, 40, 60, TAP_MAX_MS / 2, 'mouse');
        expect(t.taps).toEqual([[40, 60]]);
    });

    it('takes neither a long press nor a slide for a tap', () => {
        const t = setup();
        t.pointer('pointerdown', 1, 40, 60);
        t.pointer('pointerup', 1, 40, 60, TAP_MAX_MS * 2);
        t.pointer('pointerdown', 1, 40, 60, TAP_MAX_MS * 3);
        t.pointer('pointermove', 1, 40 + TAP_SLOP * 2, 60, TAP_MAX_MS * 3);
        t.pointer('pointerup', 1, 40 + TAP_SLOP * 2, 60, TAP_MAX_MS * 3 + 10);
        expect(t.taps).toEqual([]);
    });

    it('zooms in on a double tap, as well as reporting each tap', () => {
        const t = setup();
        t.pointer('pointerdown', 1, 40, 60, 0);
        t.pointer('pointerup', 1, 40, 60, 50);
        t.pointer('pointerdown', 1, 40, 60, 150);
        t.pointer('pointerup', 1, 40, 60, 200);
        expect(t.taps.length).toBe(2);
        expect(t.zooms).toEqual([[ZOOM_PER_DOUBLE_TAP, 40, 60]]);
    });
});
