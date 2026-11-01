// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { destroyElement, refreshView, updateView } from '@mvtjs/html';
import { REST_SETTINGS, FRACTAL_KINDS } from '../data';
import { createScopeModel } from '../models';
import { ScopeView } from './scope-view';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The width of the Mandelbrot set's home view, where the explorer starts. */
const HOME_SPAN = REST_SETTINGS['mandelbrot'].width;

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
    const model = createScopeModel();
    const view = ScopeView({ model });
    document.body.replaceChildren(view);
    refreshView(view);
    const canvas = view.querySelector('.scope-image') as HTMLCanvasElement;
    const pointer = (kind: string, id: number, x: number, y: number): void => {
        canvas.dispatchEvent(new PointerEvent(kind, {
            pointerId: id, clientX: x, clientY: y, pointerType: 'touch', button: 0, cancelable: true,
        }));
    };
    const reading = (label: string): string => {
        for (const row of view.querySelectorAll('.scope-reading')) {
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

describe('ScopeView', () => {
    beforeEach(() => {
        vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sizes the picture to the canvas, a sample per pixel', () => {
        const t = setup();

        expect(t.canvas.width).toBe(WIDTH);
        expect(t.canvas.height).toBe(HEIGHT);
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
        const before = t.model.centreRe;
        t.pointer('pointerdown', 1, 200, 150);
        t.pointer('pointermove', 1, 300, 150);

        // A hundred pixels is a quarter of the width
        expect(t.model.centreRe).toBeCloseTo(before - HOME_SPAN / 4);
    });

    it('keeps the point under a pinch under the fingers', () => {
        const t = setup();
        // The point a quarter of the way across, at the middle row
        const re = t.model.centreRe - HOME_SPAN / 4;
        t.pointer('pointerdown', 1, 50, 150);
        t.pointer('pointerdown', 2, 150, 150);
        t.pointer('pointermove', 2, 250, 150);
        t.pointer('pointermove', 1, -50, 150);

        expect(t.model.magnification).toBeCloseTo(3);
        // The fingers' middle is back where it started, a quarter across
        const pointAtMiddle = t.model.centreRe + (100 - WIDTH / 2) * (t.model.width / WIDTH);
        expect(pointAtMiddle).toBeCloseTo(re, 10);
        refreshView(t.view);
        expect(t.reading('Zoom')).toBe('3.00x');
    });

    it('lists every fractal, showing the one explored', () => {
        const t = setup();
        const select = t.view.querySelector('.scope-fractal-select') as HTMLSelectElement;
        const options = select.querySelectorAll('option');

        expect(options.length).toBe(FRACTAL_KINDS.length);
        expect(options[0].textContent).toBe('Mandelbrot set');
        expect(select.value).toBe('mandelbrot');
    });

    it('switches fractal from the list', () => {
        const t = setup();
        const select = t.view.querySelector('.scope-fractal-select') as HTMLSelectElement;
        select.value = 'phoenix';
        select.dispatchEvent(new Event('input'));
        refreshView(t.view);

        expect(t.model.fractal).toBe('phoenix');
        expect(select.value).toBe('phoenix');
        expect(t.reading('Zoom')).toBe('1.00x');
    });

    it('follows the model when the fractal changes elsewhere', () => {
        const t = setup();
        t.model.chooseFractal('tricorn');
        refreshView(t.view);

        expect((t.view.querySelector('.scope-fractal-select') as HTMLSelectElement).value).toBe('tricorn');
    });

    it('chooses a palette', () => {
        const t = setup();
        t.button('Ice').click();
        refreshView(t.view);

        expect(t.button('Ice').getAttribute('aria-pressed')).toBe('true');
        expect(t.button('Ember').getAttribute('aria-pressed')).toBe('false');
    });

    it('asks for a photo, and says so until it is taken', () => {
        const t = setup();
        t.button('Photo').click();
        refreshView(t.view);

        const photoButton = t.view.querySelectorAll('.scope-action')[0];
        expect(photoButton.textContent).toBe('Sharpening...');

        // The picture is computed in the view's update step
        for (let i = 0; i < 30; i++) {
            t.model.update(16);
            updateView(t.view, 16);
        }
        refreshView(t.view);
        expect(photoButton.textContent).toBe('Photo');
    });

    it('goes home on reset', () => {
        const t = setup();
        t.model.magnifyAbout(10, -0.75, 0.1);
        t.button('Reset').click();

        expect(t.model.magnification).toBe(1);
    });

    it('lets go of the canvas when destroyed', () => {
        const t = setup();
        destroyElement(t.view);
        const before = t.model.centreRe;
        t.pointer('pointerdown', 1, 200, 150);
        t.pointer('pointermove', 1, 300, 150);

        expect(t.model.centreRe).toBe(before);
    });
});
