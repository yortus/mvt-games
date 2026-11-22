import { describe, expect, it } from 'vitest';
import { Container, type FederatedPointerEvent, type FederatedWheelEvent } from 'pixi.js';
import { listenToDragZoom } from './listen-to-drag-zoom';

describe('listenToDragZoom', () => {
    it('reports one pointer\'s moves as drags, from a press on the target until its release', () => {
        const { target, events } = listen();
        target.emit('globalpointermove', touch(1, 5, 5));
        target.emit('pointerdown', touch(1, 10, 20));
        target.emit('globalpointermove', touch(1, 30, 25));
        target.emit('pointerupoutside', touch(1, 30, 25));
        target.emit('globalpointermove', touch(1, 60, 70));
        expect(events).toEqual(['began', 'drag 20,5', 'ended']);
    });

    it('reports two fingers moving apart as a zoom, ignores a third, and drags on with the finger left behind, without a jump', () => {
        const { target, events } = listen();
        target.emit('pointerdown', touch(1, 0, 0));
        target.emit('pointerdown', touch(2, 100, 0));
        target.emit('pointerdown', touch(3, 50, 50));
        target.emit('globalpointermove', touch(2, 200, 0));
        target.emit('globalpointermove', touch(3, 90, 90));
        target.emit('pointerup', touch(1, 0, 0));
        target.emit('globalpointermove', touch(2, 210, 0));
        expect(events).toEqual(['began', 'zoom 2', 'drag 10,0']);
    });

    it('zooms in as the wheel turns toward the page, the same for a notch counted in lines as in pixels', () => {
        const { target, events } = listen();
        target.emit('wheel', wheel(-100, 0));
        target.emit('wheel', wheel(-100 / 16, 1));
        const [inPixels, inLines] = events.map((event) => Number(event.split(' ')[1]));
        expect(inPixels).toBeGreaterThan(1);
        expect(inLines).toBe(inPixels);
    });
});

function listen(): { target: Container; events: string[] } {
    const target = new Container();
    const events: string[] = [];
    listenToDragZoom({
        target,
        onDragged: (dx, dy) => events.push(`drag ${dx},${dy}`),
        onZoomed: (factor) => events.push(`zoom ${Math.round(factor * 1000) / 1000}`),
        onGestureBegan: () => events.push('began'),
        onGestureEnded: () => events.push('ended'),
    });
    return { target, events };
}

/** A pointer event from finger `pointerId`, at (x, y) in the target's pixels. */
function touch(pointerId: number, x: number, y: number): FederatedPointerEvent {
    return { pointerId, getLocalPosition: () => ({ x, y }) } as unknown as FederatedPointerEvent;
}

/** A wheel event that turned by `deltaY`, in pixels (`deltaMode` 0) or lines (1). */
function wheel(deltaY: number, deltaMode: number): FederatedWheelEvent {
    return { deltaY, deltaMode } as unknown as FederatedWheelEvent;
}
