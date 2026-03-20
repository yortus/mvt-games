import { Container } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface KeyboardInputBindings {
    onXDirectionChanged?(direction: 'left' | 'none' | 'right'): void;
    onYDirectionChanged?(direction: 'up' | 'none' | 'down'): void;
    onPrimaryButtonChanged?(pressed: boolean): void;
    onSecondaryButtonChanged?(pressed: boolean): void;
    onRestartButtonChanged?(pressed: boolean): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createKeyboardInputView(bindings: KeyboardInputBindings): Container {
    const view = new Container();
    view.label = 'keyboard-input';

    const keyFlags = {
        ArrowLeft: 1 << 0,
        ArrowRight: 1 << 1,
        ArrowUp: 1 << 2,
        ArrowDown: 1 << 3,
        a: 1 << 4,
        d: 1 << 5,
        w: 1 << 6,
        s: 1 << 7,
    };
    let pressedKeys = 0; // bit field for currently pressed keys
    const onKeyDown = (e: KeyboardEvent): void => handleKeyboardEvent(e, true);
    const onKeyUp = (e: KeyboardEvent): void => handleKeyboardEvent(e, false);

    function handleKeyboardEvent(e: KeyboardEvent, isDown: boolean): void {
        if (e.key !== 'Enter' && e.key !== 'Shift') e.preventDefault();
        const keyFlag = keyFlags[e.key as keyof typeof keyFlags] ?? 0;
        const oldPressedKeys = pressedKeys;
        pressedKeys = isDown ? pressedKeys | keyFlag : pressedKeys & ~keyFlag;

        const oldLeft = oldPressedKeys & (keyFlags.ArrowLeft | keyFlags.a);
        const newLeft = pressedKeys & (keyFlags.ArrowLeft | keyFlags.a);
        const oldRight = oldPressedKeys & (keyFlags.ArrowRight | keyFlags.d);
        const newRight = pressedKeys & (keyFlags.ArrowRight | keyFlags.d);
        const oldUp = oldPressedKeys & (keyFlags.ArrowUp | keyFlags.w);
        const newUp = pressedKeys & (keyFlags.ArrowUp | keyFlags.w);
        const oldDown = oldPressedKeys & (keyFlags.ArrowDown | keyFlags.s);
        const newDown = pressedKeys & (keyFlags.ArrowDown | keyFlags.s);

        if (oldLeft !== newLeft) bindings.onXDirectionChanged?.(newLeft ? 'left' : newRight ? 'right' : 'none');
        if (oldRight !== newRight) bindings.onXDirectionChanged?.(newRight ? 'right' : newLeft ? 'left' : 'none');
        if (oldUp !== newUp) bindings.onYDirectionChanged?.(newUp ? 'up' : newDown ? 'down' : 'none');
        if (oldDown !== newDown) bindings.onYDirectionChanged?.(newDown ? 'down' : newUp ? 'up' : 'none');
        if (e.key === ' ') bindings.onPrimaryButtonChanged?.(isDown);
        if (e.key === 'Shift') bindings.onSecondaryButtonChanged?.(isDown);
        if (e.key === 'Enter') bindings.onRestartButtonChanged?.(isDown);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    view.on('destroyed', () => {
        console.log('Destroying keyboard input view, removing event listeners');
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
    });

    return view;
}
