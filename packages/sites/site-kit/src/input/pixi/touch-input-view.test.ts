import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, EventBoundary, FederatedPointerEvent, Text } from 'pixi.js';
// Pixi's hit testing, which the event boundary does, needs its events added to every container
import 'pixi.js/events';
import { refreshView } from '@mvtjs/pixi';
import { type DpadKind, TouchInputView, type TouchInputViewBindings } from './touch-input-view';

/** A thumb pressed towards the left of the d-pad, well outside its dead zone. */
const LEFT_OF_MIDDLE = { x: -50, y: 0 };

describe('TouchInputView', () => {
    // Measuring a button's label needs a canvas, which the unit tests have none of
    beforeEach(() => {
        vi.spyOn(Text.prototype, 'width', 'get').mockReturnValue(10);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('reports a rebuild\'s release of a held direction after the frame, not during its refresh', async () => {
        const { view, onXDirectionChanged, changeControls, pressDpad } = setUp();
        pressDpad();
        expect(onXDirectionChanged).toHaveBeenCalledExactlyOnceWith('left');
        onXDirectionChanged.mockClear();

        changeControls();
        refreshView(view);
        expect(onXDirectionChanged).not.toHaveBeenCalled();

        await Promise.resolve();
        expect(onXDirectionChanged).toHaveBeenCalledExactlyOnceWith('none');
    });

    it('reports nothing for a rebuild while no direction is held', async () => {
        const { view, onXDirectionChanged, changeControls } = setUp();
        changeControls();
        refreshView(view);
        await Promise.resolve();
        expect(onXDirectionChanged).not.toHaveBeenCalled();
    });

    it('releases a button held through a rebuild, after the frame', async () => {
        const { view, onPrimaryButtonChanged, changeControls, primaryHit } = setUp({ hasPrimaryButton: () => true });
        primaryHit().emit('pointerdown', touch(1));
        changeControls();
        refreshView(view);
        expect(onPrimaryButtonChanged.mock.calls).toEqual([[true]]);
        await Promise.resolve();
        expect(onPrimaryButtonChanged.mock.calls).toEqual([[true], [false]]);
    });

    it('lets a button go only when its own finger lifts, not another', () => {
        const { onPrimaryButtonChanged, primaryHit } = setUp({ hasPrimaryButton: () => true });
        primaryHit().emit('pointerdown', touch(1));
        primaryHit().emit('pointerup', touch(2));
        expect(onPrimaryButtonChanged.mock.calls).toEqual([[true]]);
        primaryHit().emit('pointerupoutside', touch(1));
        expect(onPrimaryButtonChanged.mock.calls).toEqual([[true], [false]]);
    });

    it('shows a button held down while its finger is on it', () => {
        const { view, primaryHit } = setUp({ hasPrimaryButton: () => true });
        // The held fill is drawn just under the hit area
        const heldFill = (): Container => {
            const group = primaryHit().parent as Container;
            return group.children[group.getChildIndex(primaryHit()) - 1];
        };
        refreshView(view);
        expect(heldFill().visible).toBe(false);
        primaryHit().emit('pointerdown', touch(1));
        refreshView(view);
        expect(heldFill().visible).toBe(true);
        primaryHit().emit('pointerup', touch(1));
        refreshView(view);
        expect(heldFill().visible).toBe(false);
    });

    it('releases a direction when its finger lifts while the controls are hidden, as Pixi sends that to a hidden object', () => {
        const { view, onXDirectionChanged } = setUp();
        const stage = new Container();
        stage.addChild(view);
        refreshView(view);
        const boundary = new EventBoundary(stage);
        // Nothing renders here, and Pixi works out world transforms as it renders.
        // So every object's pixels are the stage's, and the d-pad's middle is at the stage's origin
        boundary.mapEvent(pointerEvent(boundary, 'pointerdown', LEFT_OF_MIDDLE.x, LEFT_OF_MIDDLE.y));
        expect(onXDirectionChanged.mock.calls).toEqual([['left']]);

        // As the page hides the touch controls while the game is paused
        view.visible = false;
        boundary.mapEvent(pointerEvent(boundary, 'pointerup', LEFT_OF_MIDDLE.x, LEFT_OF_MIDDLE.y));
        expect(onXDirectionChanged.mock.calls).toEqual([['left'], ['none']]);
    });
});

function setUp(more: Partial<TouchInputViewBindings> = {}) {
    let dpadKind: DpadKind = 'four-way';
    const onXDirectionChanged = vi.fn();
    const onPrimaryButtonChanged = vi.fn();
    const view = TouchInputView({
        canvasWidth: () => 800,
        canvasHeight: () => 600,
        gameX: () => 0,
        gameY: () => 0,
        gameWidth: () => 800,
        gameHeight: () => 600,
        scale: () => 1,
        hasDpad: () => true,
        dpadKind: () => dpadKind,
        hasPrimaryButton: () => false,
        hasSecondaryButton: () => false,
        primaryLabel: () => 'A',
        secondaryLabel: () => '',
        isJoystickFloating: () => false,
        onXDirectionChanged,
        onPrimaryButtonChanged,
        ...more,
    });
    const pressDpad = (): void => {
        // The d-pad's hit area is the last thing drawn in its group
        const hit = (view.children[0] as Container).children.at(-1) as Container;
        hit.emit('pointerdown', { pointerId: 1, getLocalPosition: () => LEFT_OF_MIDDLE } as unknown as FederatedPointerEvent);
    };
    // The primary button's hit area is drawn under its label, which is last
    const primaryHit = (): Container => (view.children[1] as Container).children.at(-2) as Container;
    const changeControls = (): void => {
        dpadKind = 'left-right';
    };
    return { view, onXDirectionChanged, onPrimaryButtonChanged, changeControls, pressDpad, primaryHit };
}

/** A touch of finger `pointerId`, as Pixi's event system passes it on. */
function touch(pointerId: number): FederatedPointerEvent {
    return { pointerId, getLocalPosition: () => ({ x: 0, y: 0 }) } as unknown as FederatedPointerEvent;
}

/** A touch event at (x, y) on the stage, for Pixi's event boundary to hit-test and send on. */
function pointerEvent(boundary: EventBoundary, type: string, x: number, y: number): FederatedPointerEvent {
    const event = new FederatedPointerEvent(boundary);
    event.type = type;
    event.pointerId = 1;
    event.pointerType = 'touch';
    event.button = 0;
    event.global.set(x, y);
    event.screen.set(x, y);
    return event;
}
