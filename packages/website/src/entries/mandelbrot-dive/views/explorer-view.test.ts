// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { destroyElement, refreshView } from '@mvtjs/html';
import { HOME_SPAN } from '../data';
import { createExplorerModel } from '../models';
import { ExplorerView } from './explorer-view';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The size the image's canvas is laid out at, in CSS pixels. */
const WIDTH = 400;
const HEIGHT = 300;

/**
 * A resize observer that reports at once, with the canvas laid out at
 * WIDTH by HEIGHT: the test page does no layout of its own.
 */
function FakeResizeObserver(callback: () => void): Pick<ResizeObserver, 'observe' | 'disconnect'> {
    return {
        observe(target) {
            Object.defineProperty(target, 'clientWidth', { value: WIDTH, configurable: true });
            Object.defineProperty(target, 'clientHeight', { value: HEIGHT, configurable: true });
            callback();
        },
        disconnect() {},
    };
}

function setup() {
    const model = createExplorerModel();
    const view = ExplorerView({ model });
    document.body.replaceChildren(view);
    refreshView(view);
    const canvas = view.querySelector('.dive-image') as HTMLCanvasElement;
    const pointer = (kind: string, id: number, x: number, y: number): void => {
        canvas.dispatchEvent(new PointerEvent(kind, {
            pointerId: id, clientX: x, clientY: y, pointerType: 'touch', button: 0, cancelable: true,
        }));
    };
    const reading = (label: string): string => {
        for (const row of view.querySelectorAll('.dive-reading')) {
            if (row.querySelector('dt')?.textContent === label) return row.querySelector('dd')?.textContent ?? '';
        }
        return '';
    };
    const button = (text: string): HTMLButtonElement => {
        for (const b of view.querySelectorAll('button')) {
            if (b.textContent === text || b.getAttribute('aria-label') === text) return b;
        }
        throw new Error(`No button '${text}'`);
    };
    return { model, view, canvas, pointer, reading, button };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExplorerView', () => {
    beforeEach(() => {
        vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sizes the image to the canvas, a sample per pixel', () => {
        const t = setup();

        expect(t.model.field.cols).toBe(WIDTH);
        expect(t.model.field.rows).toBe(HEIGHT);
    });

    it('shows where the view is, and how far in', () => {
        const t = setup();

        expect(t.reading('Real')).toBe('-0.60000');
        expect(t.reading('Imaginary')).toBe('0.00000');
        expect(t.reading('Zoom')).toBe('1.00x');
        expect(t.reading('Detail')).toBe('180');
    });

    it('drags the view the other way to the finger, in units of the plane', () => {
        const t = setup();
        const before = t.model.region.centerRe;
        t.pointer('pointerdown', 1, 200, 150);
        t.pointer('pointermove', 1, 300, 150);

        // A hundred pixels is a quarter of the width
        expect(t.model.region.centerRe).toBeCloseTo(before - HOME_SPAN / 4);
        expect(t.model.isGesturing).toBe(true);

        t.pointer('pointerup', 1, 300, 150);
        expect(t.model.isGesturing).toBe(false);
    });

    it('keeps the point under a pinch under the fingers', () => {
        const t = setup();
        // The point a quarter of the way across, at the middle row
        const re = t.model.region.centerRe - HOME_SPAN / 4;
        t.pointer('pointerdown', 1, 50, 150);
        t.pointer('pointerdown', 2, 150, 150);
        t.pointer('pointermove', 2, 250, 150);
        t.pointer('pointermove', 1, -50, 150);

        expect(t.model.zoom).toBeCloseTo(3);
        // The fingers' middle is back where it started, a quarter across
        const pointAtMiddle = t.model.region.centerRe + (100 - WIDTH / 2) * (t.model.region.span / WIDTH);
        expect(pointAtMiddle).toBeCloseTo(re, 10);
        refreshView(t.view);
        expect(t.reading('Zoom')).toBe('3.00x');
    });

    it('chooses a palette', () => {
        const t = setup();
        t.button('Ice').click();
        refreshView(t.view);

        expect(t.model.palette).toBe('ice');
        expect(t.button('Ice').getAttribute('aria-pressed')).toBe('true');
        expect(t.button('Ember').getAttribute('aria-pressed')).toBe('false');
    });

    it('asks for a photo, and says so until it is taken', () => {
        const t = setup();
        t.button('Photo').click();
        refreshView(t.view);

        expect(t.model.isPhotoPending).toBe(true);
        expect(t.view.querySelectorAll('.dive-action')[0].textContent).toBe('Sharpening...');

        for (let i = 0; i < 30; i++) t.model.update(16);
        refreshView(t.view);
        expect(t.model.photosTaken).toBe(1);
        expect(t.button('Photo')).toBeDefined();
    });

    it('goes home on reset', () => {
        const t = setup();
        t.model.zoomBy(10, -0.75, 0.1);
        t.button('Reset').click();

        expect(t.model.zoom).toBe(1);
    });

    it('lets go of the canvas when destroyed', () => {
        const t = setup();
        destroyElement(t.view);
        const before = t.model.region.centerRe;
        t.pointer('pointerdown', 1, 200, 150);
        t.pointer('pointermove', 1, 300, 150);

        expect(t.model.region.centerRe).toBe(before);
    });
});
