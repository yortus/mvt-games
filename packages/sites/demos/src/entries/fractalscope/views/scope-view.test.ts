// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { destroyElement, refreshView } from '@mvtjs/html';
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

function setup(takesKeys = false) {
    const model = createScopeModel();
    const view = ScopeView({ model, takesKeys });
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
    return { model, view, canvas, pointer, reading };
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

    it('lets go of the canvas when destroyed', () => {
        const t = setup();
        destroyElement(t.view);
        const before = t.model.centreRe;
        t.pointer('pointerdown', 1, 200, 150);
        t.pointer('pointermove', 1, 300, 150);

        expect(t.model.centreRe).toBe(before);
    });

    describe('the keys', () => {
        let view: Element | undefined;

        afterEach(() => {
            if (view !== undefined) destroyElement(view);
            view = undefined;
        });

        function setupKeys(takesKeys = true) {
            const t = setup(takesKeys);
            view = t.view;
            return t;
        }

        function press(key: string): void {
            window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        }

        function release(key: string): void {
            window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
        }

        it('zooms while + or - is held, and not at all with both', () => {
            const t = setupKeys();
            press('+');
            expect(t.model.zooming).toBe('in');
            press('-');
            expect(t.model.zooming).toBe('none');
            release('+');
            expect(t.model.zooming).toBe('out');
            release('-');
            expect(t.model.zooming).toBe('none');
        });

        it('steps through the fractals with [ and ], going round from one end to the other', () => {
            const t = setupKeys();
            const start = FRACTAL_KINDS.indexOf(t.model.fractal);
            press(']');
            expect(t.model.fractal).toBe(FRACTAL_KINDS[start + 1]);
            press('[');
            press('[');
            expect(t.model.fractal).toBe(FRACTAL_KINDS[start - 1]);

            t.model.chooseFractal(FRACTAL_KINDS[FRACTAL_KINDS.length - 1]);
            press(']');
            expect(t.model.fractal).toBe(FRACTAL_KINDS[0]);
        });

        it('lets the keys back to the scope once the mouse has picked from the list', () => {
            const t = setupKeys();
            const select = t.view.querySelector('.scope-fractal-select') as HTMLSelectElement;
            select.focus();
            select.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            select.value = 'phoenix';
            select.dispatchEvent(new Event('input', { bubbles: true }));

            expect(t.model.fractal).toBe('phoenix');
            expect(document.activeElement).not.toBe(select);
        });

        it('leaves the list its focus while the keyboard works it', () => {
            const t = setupKeys();
            const select = t.view.querySelector('.scope-fractal-select') as HTMLSelectElement;
            select.focus();
            select.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            select.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
            select.value = 'phoenix';
            select.dispatchEvent(new Event('input', { bubbles: true }));

            expect(t.model.fractal).toBe('phoenix');
            expect(document.activeElement).toBe(select);
        });

        it('takes no keys while the scope plays only to be watched', () => {
            const t = setupKeys(false);
            press('ArrowRight');
            press(']');

            expect(t.model.travelRe).toBe(0);
            expect(t.model.fractal).toBe('mandelbrot');
        });

        it('stops taking keys once destroyed', () => {
            const t = setupKeys();
            destroyElement(t.view);
            view = undefined;
            press('ArrowRight');

            expect(t.model.travelRe).toBe(0);
        });
    });
});
