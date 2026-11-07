import { describe, expect, it } from 'vitest';
import { Container, type FederatedPointerEvent } from 'pixi.js';
import { listenToPointer, type PointerOptions } from './listen-to-pointer';

describe('listenToPointer', () => {
    it('follows a press on the target, its moves anywhere, and its release, in the target\'s pixels', () => {
        const { target, events } = listen();
        target.emit('pointerdown', touch(1, 10, 20));
        target.emit('globalpointermove', touch(1, 30, 40));
        target.emit('pointerupoutside', touch(1, 500, 40));
        target.emit('globalpointermove', touch(1, 60, 70));
        expect(events).toEqual(['press 10,20', 'move 30,40', 'release 500,40']);
        expect(target.eventMode).toBe('static');
    });

    it('ignores a second finger while it follows the first', () => {
        const { target, events } = listen();
        target.emit('pointerdown', touch(1, 10, 20));
        target.emit('pointerdown', touch(2, 90, 90));
        target.emit('globalpointermove', touch(2, 80, 80));
        target.emit('pointerup', touch(2, 80, 80));
        target.emit('pointerup', touch(1, 15, 25));
        target.emit('pointerdown', touch(2, 90, 90));
        expect(events).toEqual(['press 10,20', 'release 15,25', 'press 90,90']);
    });

    it('reports a cancel as one, or as letting go when nothing listens for a cancel', () => {
        const cancelled = listen();
        cancelled.target.emit('pointerdown', touch(1, 10, 20));
        cancelled.target.emit('pointercancel', touch(1, 10, 20));
        expect(cancelled.events).toEqual(['press 10,20', 'cancel']);
        const released = listen({ onCancelled: undefined });
        released.target.emit('pointerdown', touch(1, 10, 20));
        released.target.emit('pointercancel', touch(1, 12, 22));
        expect(released.events).toEqual(['press 10,20', 'release 12,22']);
    });
});

function listen(more: Partial<PointerOptions> = {}): { target: Container; events: string[] } {
    const target = new Container();
    const events: string[] = [];
    listenToPointer({
        target,
        onPressed: (x, y) => events.push(`press ${x},${y}`),
        onMoved: (x, y) => events.push(`move ${x},${y}`),
        onReleased: (x, y) => events.push(`release ${x},${y}`),
        onCancelled: () => events.push('cancel'),
        ...more,
    });
    return { target, events };
}

/** A pointer event from finger `pointerId`, at (x, y) in the target's pixels. */
function touch(pointerId: number, x: number, y: number): FederatedPointerEvent {
    return { pointerId, getLocalPosition: () => ({ x, y }) } as unknown as FederatedPointerEvent;
}
