import { Container } from 'pixi.js';
import type { ArcadeControls } from '../arcade-controls';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/**
 * The bindings of `ArcadeControlsInputView`: the arcade controls, and where
 * it reports them. Each button is reported both ways, as it changes, for a
 * game that holds it, and as it is pressed, for a game that presses it.
 */
export interface ArcadeControlsInputViewBindings {
    /** The session's arcade controls, which the host passes to the entry as it starts. */
    readonly controls: ArcadeControls;
    readonly onXDirectionChanged?: (direction: 'left' | 'none' | 'right') => void;
    readonly onYDirectionChanged?: (direction: 'up' | 'none' | 'down') => void;
    readonly onPrimaryButtonChanged?: (pressed: boolean) => void;
    readonly onPrimaryPressed?: () => void;
    readonly onSecondaryButtonChanged?: (pressed: boolean) => void;
    readonly onSecondaryPressed?: () => void;
    readonly onRestartPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Reports the arcade controls to a game's top-level view, whose wiring
 * defines what each control means. It draws nothing, and has no update or
 * refresh step. It listens to the controls from when it is created until it
 * is destroyed, and calls its relays from within the controls' own reports,
 * which come from key and touch events, between frames. Being created and
 * being destroyed report nothing, even for a control already held, since a
 * game view is created as the session starts, during the page's frame.
 */
export function ArcadeControlsInputView(bindings: ArcadeControlsInputViewBindings): Container {
    const view = new Container();
    view.label = 'arcade-controls-input';
    const stopListening = bindings.controls.listen({
        onXDirectionChanged: bindings.onXDirectionChanged,
        onYDirectionChanged: bindings.onYDirectionChanged,
        onPrimaryButtonChanged: (pressed) => {
            bindings.onPrimaryButtonChanged?.(pressed);
            if (pressed) bindings.onPrimaryPressed?.();
        },
        onSecondaryButtonChanged: (pressed) => {
            bindings.onSecondaryButtonChanged?.(pressed);
            if (pressed) bindings.onSecondaryPressed?.();
        },
        onRestartButtonChanged: (pressed) => {
            if (pressed) bindings.onRestartPressed?.();
        },
    });
    view.on('destroyed', stopListening);
    return view;
}
