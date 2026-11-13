// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { Container } from 'pixi.js';
import { listenToPointerLoss } from './listen-to-pointer-loss';

describe('listenToPointerLoss', () => {
    it('reports the pointer followed as lost as the browser cancels it, and not another', () => {
        const { followed, losses } = listen();
        followed.id = 3;
        window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 4 }));
        expect(losses()).toBe(0);
        // Dispatched on an element, as a real cancel is, and heard on its way down
        document.body.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 3, bubbles: true }));
        expect(losses()).toBe(1);
    });

    it('reports a pointer down as the window loses focus, and nothing while none is', () => {
        const { followed, losses } = listen();
        window.dispatchEvent(new Event('blur'));
        expect(losses()).toBe(0);
        followed.id = 1;
        window.dispatchEvent(new Event('blur'));
        expect(losses()).toBe(1);
    });

    it('stops listening once the container is destroyed', () => {
        const { target, followed, losses } = listen();
        followed.id = 1;
        target.destroy();
        window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
        window.dispatchEvent(new Event('blur'));
        expect(losses()).toBe(0);
    });
});

function listen(): { target: Container; followed: { id: number | undefined }; losses: () => number } {
    const target = new Container();
    const followed: { id: number | undefined } = { id: undefined };
    let losses = 0;
    listenToPointerLoss({ target, pointerId: () => followed.id, onLost: () => losses++ });
    return { target, followed, losses: () => losses };
}
