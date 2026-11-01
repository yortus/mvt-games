import { Container } from 'pixi.js';
import type { Direction } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface KeyboardInputViewBindings {
    /** Reports an arrow key pressed, as the direction it points. */
    readonly onDirectionPressed?: (direction: Direction) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Turns the arrow keys into directions. It draws nothing, so it's an empty
 * container, which stops listening for keys when it's destroyed.
 */
export function KeyboardInputView(bindings: KeyboardInputViewBindings): Container {
    const view = new Container();
    window.addEventListener('keydown', onKeyDown);
    view.on('destroyed', () => window.removeEventListener('keydown', onKeyDown));
    return view;

    function onKeyDown(e: KeyboardEvent): void {
        const direction = DIRECTION_OF_KEY[e.key];
        if (direction === undefined) return;
        // Stops the arrow keys scrolling the page
        e.preventDefault();
        bindings.onDirectionPressed?.(direction);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DIRECTION_OF_KEY: Readonly<Record<string, Direction | undefined>> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
};
