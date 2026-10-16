import { describe, expect, it, vi } from 'vitest';
import type { Container, FederatedPointerEvent } from 'pixi.js';
import { SwipeInputView } from './swipe-input-view';

const SWIPE_DISTANCE = 10;

function makeView(): { view: Container; onSwiped: ReturnType<typeof vi.fn>; onTapped: ReturnType<typeof vi.fn> } {
    const onSwiped = vi.fn();
    const onTapped = vi.fn();
    const view = SwipeInputView({
        isEnabled: true, x: 0, y: 0, width: 500, height: 500, swipeDistance: SWIPE_DISTANCE, onSwiped, onTapped,
    });
    return { view, onSwiped, onTapped };
}

/** A pointer event from finger `pointerId`, at (x, y) in the view's pixels. */
function touch(pointerId: number, x: number, y: number): FederatedPointerEvent {
    return { pointerId, getLocalPosition: () => ({ x, y }) } as unknown as FederatedPointerEvent;
}

describe('SwipeInputView', () => {
    it('swipes the way a finger mostly slid, once it slides far enough', () => {
        const { view, onSwiped } = makeView();
        view.emit('pointerdown', touch(1, 100, 100));
        view.emit('globalpointermove', touch(1, 104, 102));
        expect(onSwiped).not.toHaveBeenCalled();
        view.emit('globalpointermove', touch(1, 112, 104));
        expect(onSwiped).toHaveBeenCalledWith('right');
        view.emit('pointerup', touch(1, 112, 104));
        expect(onSwiped).toHaveBeenCalledTimes(1);
    });

    it('swipes again each time a sliding finger turns, but not again the same way', () => {
        const { view, onSwiped } = makeView();
        view.emit('pointerdown', touch(1, 100, 100));
        view.emit('globalpointermove', touch(1, 100, 88));
        view.emit('globalpointermove', touch(1, 100, 76));
        view.emit('globalpointermove', touch(1, 88, 76));
        expect(onSwiped.mock.calls).toEqual([['up'], ['left']]);
    });

    it('taps on a touch let go without sliding', () => {
        const { view, onSwiped, onTapped } = makeView();
        view.emit('pointerdown', touch(1, 100, 100));
        view.emit('pointerup', touch(1, 103, 101));
        expect(onTapped).toHaveBeenCalledTimes(1);
        expect(onSwiped).not.toHaveBeenCalled();
    });

    it('swipes on a quick flick that slid its whole way between moves', () => {
        const { view, onSwiped, onTapped } = makeView();
        view.emit('pointerdown', touch(1, 100, 100));
        view.emit('pointerup', touch(1, 100, 130));
        expect(onSwiped).toHaveBeenCalledWith('down');
        expect(onTapped).not.toHaveBeenCalled();
    });

    it('follows only the first finger down', () => {
        const { view, onSwiped } = makeView();
        view.emit('pointerdown', touch(1, 100, 100));
        view.emit('pointerdown', touch(2, 300, 300));
        view.emit('globalpointermove', touch(2, 300, 340));
        expect(onSwiped).not.toHaveBeenCalled();
    });

    it('listens to nothing when not enabled', () => {
        const view = SwipeInputView({ isEnabled: false, x: 0, y: 0, width: 500, height: 500, swipeDistance: SWIPE_DISTANCE });
        expect(view.eventMode).not.toBe('static');
    });
});
