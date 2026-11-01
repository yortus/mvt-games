import { describe, expect, it, vi } from 'vitest';
import type { Container, FederatedPointerEvent } from 'pixi.js';
import { updateView } from '@mvtjs/pixi';
import { DragInputView, type DragInputViewBindings } from './drag-input-view';

// The ship being dragged, and its limits
const SHIP_X = 200;
const SHIP_Y = 300;
const MIN_X = 100;
const MAX_X = 400;
const MIN_Y = 0;
const MAX_Y = 500;

function makeView(more: Partial<DragInputViewBindings> = {}): {
    view: Container;
    onTouched: ReturnType<typeof vi.fn>;
    onDragged: ReturnType<typeof vi.fn>;
    onLifted: ReturnType<typeof vi.fn>;
} {
    const onTouched = vi.fn();
    const onDragged = vi.fn();
    const onLifted = vi.fn();
    const view = DragInputView({
        isEnabled: true, x: 0, y: 0, width: 1000, height: 1000,
        fromX: () => SHIP_X, fromY: () => SHIP_Y, minX: MIN_X, maxX: MAX_X, minY: MIN_Y, maxY: MAX_Y,
        onTouched, onDragged, onLifted, ...more,
    });
    return { view, onTouched, onDragged, onLifted };
}

/** A pointer event from finger `pointerId`, at (x, y) in the view's pixels. */
function touch(pointerId: number, x: number, y: number): FederatedPointerEvent {
    return { pointerId, getLocalPosition: () => ({ x, y }) } as unknown as FederatedPointerEvent;
}

describe('DragInputView', () => {
    it('drags the thing as far as the finger slides, from where it was, until the finger lets go', () => {
        const { view, onTouched, onDragged, onLifted } = makeView();
        view.emit('pointerdown', touch(1, 600, 600));
        expect(onTouched).toHaveBeenCalledTimes(1);
        view.emit('globalpointermove', touch(1, 610, 595));
        view.emit('globalpointermove', touch(1, 630, 590));
        expect(onDragged.mock.calls).toEqual([[SHIP_X + 10, SHIP_Y - 5], [SHIP_X + 30, SHIP_Y - 10]]);
        expect(onLifted).not.toHaveBeenCalled();
        view.emit('pointerupoutside', touch(1, 630, 590));
        expect(onLifted).toHaveBeenCalledTimes(1);
    });

    it('stops the thing at its limits, and turns it back as soon as the finger does', () => {
        const { view, onDragged } = makeView();
        const pastLimit = 50;
        view.emit('pointerdown', touch(1, 600, 600));
        view.emit('globalpointermove', touch(1, 600 + MAX_X - SHIP_X + pastLimit, 600));
        expect(onDragged).toHaveBeenLastCalledWith(MAX_X, SHIP_Y);
        view.emit('globalpointermove', touch(1, 600 + MAX_X - SHIP_X + pastLimit - 10, 600));
        expect(onDragged).toHaveBeenLastCalledWith(MAX_X - 10, SHIP_Y);
    });

    it('drags the thing further than the finger slides, with a gain', () => {
        const gain = 1.5;
        const { view, onDragged } = makeView({ gain });
        view.emit('pointerdown', touch(1, 600, 600));
        view.emit('globalpointermove', touch(1, 620, 590));
        expect(onDragged).toHaveBeenLastCalledWith(SHIP_X + 20 * gain, SHIP_Y - 10 * gain);
    });

    it('follows only the first finger down', () => {
        const { view, onTouched, onDragged, onLifted } = makeView();
        view.emit('pointerdown', touch(1, 100, 100));
        view.emit('pointerdown', touch(2, 300, 300));
        view.emit('globalpointermove', touch(2, 300, 340));
        view.emit('pointerup', touch(2, 300, 340));
        expect(onTouched).toHaveBeenCalledTimes(1);
        expect(onDragged).not.toHaveBeenCalled();
        expect(onLifted).not.toHaveBeenCalled();
    });

    it('follows the next finger once the first lets go, from where the thing is then', () => {
        let shipX = SHIP_X;
        const { view, onDragged } = makeView({ fromX: () => shipX });
        view.emit('pointerdown', touch(1, 100, 100));
        view.emit('pointercancel', touch(1, 100, 100));
        shipX = SHIP_X + 20;
        view.emit('pointerdown', touch(2, 300, 300));
        view.emit('globalpointermove', touch(2, 290, 300));
        expect(onDragged).toHaveBeenCalledWith(shipX - 10, SHIP_Y);
    });

    it('repeats a hold while a finger stays down, from the moment it touches', () => {
        const repeatMs = 100;
        const onHeld = vi.fn();
        const { view } = makeView({ heldRepeatMs: repeatMs, onHeld });
        updateView(view, repeatMs);
        expect(onHeld).not.toHaveBeenCalled();
        view.emit('pointerdown', touch(1, 100, 100));
        updateView(view, 1);
        expect(onHeld).toHaveBeenCalledTimes(1);
        updateView(view, repeatMs);
        expect(onHeld).toHaveBeenCalledTimes(2);
        view.emit('pointerup', touch(1, 100, 100));
        updateView(view, repeatMs * 3);
        expect(onHeld).toHaveBeenCalledTimes(2);
    });

    it('listens to nothing when not enabled', () => {
        const { view } = makeView({ isEnabled: false });
        expect(view.eventMode).not.toBe('static');
    });
});
