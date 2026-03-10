import { Container } from 'pixi.js';
import type { Direction } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface KeyboardInputBindings {
    onDirectionChange(dir: Direction): void;
    onRestartRequest(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createKeyboardPlayerInputView(bindings: KeyboardInputBindings): Container {
    const container = new Container();
    container.label = 'keyboard-player-input';

    function onKeyDown(e: KeyboardEvent): void {
        const dir = KEY_MAP[e.key];
        if (dir !== undefined) {
            e.preventDefault();
            bindings.onDirectionChange(dir);
            return;
        }
        if (e.key === 'Enter') {
            bindings.onRestartRequest();
        }
    }

    window.addEventListener('keydown', onKeyDown);

    const originalDestroy = container.destroy.bind(container);
    container.destroy = (options) => {
        window.removeEventListener('keydown', onKeyDown);
        originalDestroy(options);
    };

    return container;
}

// ---------------------------------------------------------------------------
// Key Map
// ---------------------------------------------------------------------------

const KEY_MAP: Record<string, Direction> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    w: 'up',
    s: 'down',
    a: 'left',
    d: 'right',
};
