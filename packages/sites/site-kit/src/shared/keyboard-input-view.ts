import { Container } from 'pixi.js';
import { type KeyboardInputBindings, listenToKeyboard } from '../input';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** The bindings of `KeyboardInputView`. They say whether it is active, and where it reports key presses. */
export type KeyboardInputViewBindings = KeyboardInputBindings;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Keyboard input for the games on a Pixi stage, as `listenToKeyboard`
 * describes it. It shows nothing, and stops listening when it is destroyed.
 */
export function KeyboardInputView(bindings: KeyboardInputViewBindings): Container {
    const view = new Container();
    view.label = 'keyboard-input';
    const stop = listenToKeyboard(bindings);
    view.on('destroyed', stop);
    return view;
}
