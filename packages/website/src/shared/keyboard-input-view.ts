import { Container } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** The bindings of `KeyboardInputView`. They say whether it is active, and where it reports key presses. */
export interface KeyboardInputViewBindings {
    /**
     * Whether to handle key events. It is true while an entry that takes
     * input is running. When it is false, key events are ignored, so the
     * rest of the page, such as the Arcade's search box, can use them. Any
     * held keys are released. It is read on every key press and release.
     */
    readonly isActive: () => boolean;
    onXDirectionChanged?: (direction: 'left' | 'none' | 'right') => void;
    onYDirectionChanged?: (direction: 'up' | 'none' | 'down') => void;
    onPrimaryButtonChanged?: (pressed: boolean) => void;
    onSecondaryButtonChanged?: (pressed: boolean) => void;
    onRestartButtonChanged?: (pressed: boolean) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Keyboard input for the games. The arrow keys or WASD set the direction,
 * Space and Shift press the two buttons, and Enter restarts. It shows
 * nothing.
 *
 * It ignores key presses inside a modal dialog, such as the pause menu, so
 * the dialog gets them. It still counts a key's release there, so a key held
 * as the dialog opens is let go. While no entry runs, it ignores every key
 * event, so they reach the rest of the page.
 */
export function KeyboardInputView(bindings: KeyboardInputViewBindings): Container {
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
    // A bit for each key held
    let pressedKeys = 0;
    const onKeyDown = (e: KeyboardEvent): void => handleKeyboardEvent(e, true);
    const onKeyUp = (e: KeyboardEvent): void => handleKeyboardEvent(e, false);

    function handleKeyboardEvent(e: KeyboardEvent, isDown: boolean): void {
        if (!bindings.isActive()) {
            // Release any held keys, so none carry over into the next entry
            pressedKeys = 0;
            return;
        }
        // A modal dialog's keys are its own, such as a pause menu's Tab, Space
        // and slider arrows. A release still counts, so a key held as the
        // dialog opens is let go.
        const isInDialog = e.target instanceof Element && e.target.closest('[aria-modal="true"]') !== null;
        if (isInDialog && isDown) return;
        if (!isInDialog && e.key !== 'Enter' && e.key !== 'Shift') e.preventDefault();
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
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
    });

    return view;
}
