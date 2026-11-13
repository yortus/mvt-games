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

    it('ends the pointer followed, if its release went missing, as the only pointer of its kind presses', () => {
        const { target, events } = listen();
        target.emit('pointerdown', touch(1, 10, 20, true));
        // The first finger's release went missing, so the next finger down is the only one, and primary
        target.emit('pointerdown', touch(2, 90, 90, true));
        target.emit('pointerup', touch(2, 95, 95));
        expect(events).toEqual(['press 10,20', 'cancel', 'press 90,90', 'release 95,95']);
        // A mouse pressed again, its release missed, ends the press before, where it was last, when nothing listens for a cancel
        const released = listen({ onCancelled: undefined });
        released.target.emit('pointerdown', touch(1, 10, 20, true, 'mouse'));
        released.target.emit('globalpointermove', touch(1, 30, 40));
        released.target.emit('pointerdown', touch(1, 50, 60, true, 'mouse'));
        expect(released.events).toEqual(['press 10,20', 'move 30,40', 'release 30,40', 'press 50,60']);
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

    it('reports a pointer moving while none is followed as hovering, and not once one is', () => {
        const { target, events } = listen({ onHovered: (x, y) => events.push(`hover ${x},${y}`) });
        target.emit('globalpointermove', touch(1, 5, 5));
        target.emit('pointerdown', touch(1, 10, 20));
        target.emit('globalpointermove', touch(1, 30, 40));
        target.emit('globalpointermove', touch(2, 70, 70));
        expect(events).toEqual(['hover 5,5', 'press 10,20', 'move 30,40']);
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

/**
 * A pointer event from finger `pointerId`, at (x, y) in the target's pixels.
 * A primary pointer is the only one of its kind down.
 */
function touch(pointerId: number, x: number, y: number, isPrimary = false, pointerType = 'touch'): FederatedPointerEvent {
    return { pointerId, isPrimary, pointerType, getLocalPosition: () => ({ x, y }) } as unknown as FederatedPointerEvent;
}
