// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { type ElementPointerOptions, listenToElementPointer } from './listen-to-element-pointer';

describe('listenToElementPointer', () => {
    it('follows a press on the element, its moves, and its release, in the viewport\'s pixels', () => {
        const { send, events } = listen();
        const down = send('pointerdown', 1, 10, 20);
        send('pointermove', 1, 30, 40);
        send('pointerup', 1, 50, 60);
        send('pointermove', 1, 70, 80);
        expect(events).toEqual(['press 10,20', 'move 30,40', 'release 50,60']);
        expect(down.defaultPrevented).toBe(true);
    });

    it('ignores a second finger while it follows the first', () => {
        const { send, events } = listen();
        send('pointerdown', 1, 10, 20);
        send('pointerdown', 2, 90, 90);
        send('pointermove', 2, 80, 80);
        send('pointerup', 2, 80, 80);
        send('pointerup', 1, 15, 25);
        expect(events).toEqual(['press 10,20', 'release 15,25']);
    });

    it('leaves the mouse\'s other buttons, and presses it is told not to follow, alone', () => {
        const { send, events } = listen({ isPressFollowed: (event) => event.clientX < 100 });
        const rightClick = send('pointerdown', 1, 10, 20, { pointerType: 'mouse', button: 2 });
        send('pointerdown', 1, 200, 20);
        expect(events).toEqual([]);
        expect(rightClick.defaultPrevented).toBe(false);
    });

    it('counts a capture lost without a pointerup as letting go, where the pointer was last seen', () => {
        const { send, events } = listen();
        send('pointerdown', 1, 10, 20);
        send('pointermove', 1, 30, 40);
        send('lostpointercapture', 1, 0, 0);
        expect(events).toEqual(['press 10,20', 'move 30,40', 'release 30,40']);
    });

    it('reports a cancel as one, or as letting go when nothing listens for a cancel', () => {
        const cancelled = listen();
        cancelled.send('pointerdown', 1, 10, 20);
        cancelled.send('pointercancel', 1, 0, 0);
        expect(cancelled.events).toEqual(['press 10,20', 'cancel']);
        const released = listen({ onCancelled: undefined });
        released.send('pointerdown', 1, 10, 20);
        released.send('pointercancel', 1, 0, 0);
        expect(released.events).toEqual(['press 10,20', 'release 10,20']);
    });

    it('reports nothing as it stops, even mid-press, and nothing after', () => {
        const { send, events, stop } = listen();
        send('pointerdown', 1, 10, 20);
        stop();
        send('lostpointercapture', 1, 0, 0);
        send('pointerdown', 1, 10, 20);
        expect(events).toEqual(['press 10,20']);
    });
});

function listen(more: Partial<ElementPointerOptions> = {}) {
    const element = document.createElement('div');
    document.body.replaceChildren(element);
    const events: string[] = [];
    const stop = listenToElementPointer({
        element,
        onPressed: (x, y) => events.push(`press ${x},${y}`),
        onMoved: (x, y) => events.push(`move ${x},${y}`),
        onReleased: (x, y) => events.push(`release ${x},${y}`),
        onCancelled: () => events.push('cancel'),
        ...more,
    });
    /** Sends a pointer event of `kind` from pointer `id` at (x, y), and returns it. */
    const send = (kind: string, id: number, x: number, y: number, extra: PointerEventInit = {}): PointerEvent => {
        const event = new PointerEvent(kind, {
            pointerId: id, clientX: x, clientY: y, pointerType: 'touch', button: 0, bubbles: true, cancelable: true, ...extra,
        });
        element.dispatchEvent(event);
        return event;
    };
    return { send, events, stop };
}
