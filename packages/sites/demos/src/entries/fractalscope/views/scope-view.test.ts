// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { destroyElement, refreshView, updateView } from '@mvtjs/html';
import { REST_SETTINGS, FRACTAL_KINDS, MAX_RECENTRE_MS, TRAVEL_RATE } from '../data';
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
        expect(select.value).toBe('mandelbrot');
        expect(select.selectedOptions[0].textContent).toBe('Mandelbrot set');
    });

    it('lists the fractals in alphabetical order', () => {
        const t = setup();
        const options = t.view.querySelectorAll('.scope-fractal-select option');
        const names = Array.from(options, (option) => option.textContent);

        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
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
        t.model.chooseFractal('circle-lace');
        refreshView(t.view);

        expect((t.view.querySelector('.scope-fractal-select') as HTMLSelectElement).value).toBe('circle-lace');
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
        t.model.update(MAX_RECENTRE_MS);

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

        it('travels while an arrow is held, and stops when it comes up', () => {
            const t = setupKeys();
            press('ArrowRight');
            expect(t.model.travelRe).toBe(1);
            t.model.update(100);

            expect(t.model.centreRe).toBeCloseTo(REST_SETTINGS['mandelbrot'].centreRe + TRAVEL_RATE * HOME_SPAN * 0.1);

            release('ArrowRight');
            expect(t.model.travelRe).toBe(0);
        });

        it('takes up as up the imaginary axis, as the picture is drawn', () => {
            const t = setupKeys();
            press('w');
            expect(t.model.travelIm).toBe(1);
            release('w');
            press('ArrowDown');
            expect(t.model.travelIm).toBe(-1);
            release('ArrowDown');
        });

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

        it('steps through the palettes with C, and back with Shift', () => {
            const t = setupKeys();
            const swatch = (): string | null | undefined => t.view.querySelector('.scope-swatch.chosen')?.getAttribute('aria-label');
            refreshView(t.view);
            const first = swatch();

            press('c');
            refreshView(t.view);
            expect(swatch()).not.toBe(first);

            press('C');
            refreshView(t.view);
            expect(swatch()).toBe(first);
        });

        it('picks a different fractal and palette for a surprise', () => {
            const t = setupKeys();
            refreshView(t.view);
            const fractal = t.model.fractal;
            const palette = t.view.querySelector('.scope-swatch.chosen')?.getAttribute('aria-label');

            press('x');
            refreshView(t.view);

            expect(t.model.fractal).not.toBe(fractal);
            expect(t.view.querySelector('.scope-swatch.chosen')?.getAttribute('aria-label')).not.toBe(palette);
        });

        it('recentres with R', () => {
            const t = setupKeys();
            t.model.magnifyAbout(4, 0, 0);
            press('r');
            t.model.update(MAX_RECENTRE_MS);

            expect(t.model.magnification).toBe(1);
        });

        it('hides the panel with H, and brings it back with the same key or the Controls button', () => {
            const t = setupKeys();
            const panel = t.view.querySelector('.scope-panel') as HTMLElement;
            const show = t.view.querySelector('.scope-show') as HTMLButtonElement;
            const isShowing = (element: HTMLElement): boolean => element.style.display !== 'none' && !element.hidden;

            refreshView(t.view);
            expect(isShowing(panel)).toBe(true);
            expect(isShowing(show)).toBe(false);

            press('h');
            refreshView(t.view);
            expect(isShowing(panel)).toBe(false);
            expect(isShowing(show)).toBe(true);

            show.click();
            refreshView(t.view);
            expect(isShowing(panel)).toBe(true);

            t.button('Hide').click();
            refreshView(t.view);
            expect(isShowing(panel)).toBe(false);

            press('h');
            refreshView(t.view);
            expect(isShowing(panel)).toBe(true);
        });

        it('asks for a photo with P', () => {
            const t = setupKeys();
            press('p');
            refreshView(t.view);

            expect(t.button('Sharpening...').textContent).toBe('Sharpening...');
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
