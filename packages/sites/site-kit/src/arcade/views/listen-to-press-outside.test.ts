// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { listenToPressOutside } from './listen-to-press-outside';

describe('listenToPressOutside', () => {
    it('reports a press outside what is open, and none inside it', () => {
        const { inside, outside, presses } = listen();
        press(inside);
        expect(presses()).toBe(0);
        press(outside);
        expect(presses()).toBe(1);
    });

    it('reports nothing while nothing is open', () => {
        const { outside, presses, close } = listen();
        close();
        press(outside);
        expect(presses()).toBe(0);
    });

    it('hears a press that a handler on the page stops, when it captures', () => {
        const stopped = listen({ isCapturing: true });
        stopped.outside.addEventListener('pointerdown', (e) => e.stopPropagation());
        press(stopped.outside);
        expect(stopped.presses()).toBe(1);
    });

    it('reports nothing once stopped', () => {
        const { outside, presses, stop } = listen();
        stop();
        press(outside);
        expect(presses()).toBe(0);
    });
});

function listen(more: { isCapturing?: boolean } = {}) {
    const inside = document.createElement('div');
    const outside = document.createElement('div');
    document.body.replaceChildren(inside, outside);
    let isOpen = true;
    let presses = 0;
    const stop = listenToPressOutside({
        isOpen: () => isOpen,
        isInside: (target) => inside.contains(target),
        onPressedOutside: () => presses++,
        ...more,
    });
    return {
        inside,
        outside,
        presses: () => presses,
        close: () => { isOpen = false; },
        stop,
    };
}

function press(element: Element): void {
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
}
