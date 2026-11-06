import { describe, expect, it, vi } from 'vitest';
import type { Container, FederatedPointerEvent } from 'pixi.js';
import { refreshView } from '@mvtjs/pixi';
import { type DpadKind, TouchInputView } from './touch-input-view';

/** A thumb pressed towards the left of the d-pad, well outside its dead zone. */
const LEFT_OF_MIDDLE = { x: -50, y: 0 };

describe('TouchInputView', () => {
    it('reports a held direction let go by a rebuild once the frame has finished, not during its refresh', async () => {
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
});

function setUp() {
    let dpadKind: DpadKind = 'four-way';
    const onXDirectionChanged = vi.fn();
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
        primaryLabel: () => '',
        secondaryLabel: () => '',
        isJoystickFloating: () => false,
        onXDirectionChanged,
    });
    const pressDpad = (): void => {
        // The d-pad's hit area is the last thing drawn in its group
        const hit = (view.children[0] as Container).children.at(-1) as Container;
        hit.emit('pointerdown', { pointerId: 1, getLocalPosition: () => LEFT_OF_MIDDLE } as unknown as FederatedPointerEvent);
    };
    const changeControls = (): void => {
        dpadKind = 'left-right';
    };
    return { view, onXDirectionChanged, changeControls, pressDpad };
}
