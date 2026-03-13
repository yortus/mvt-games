import { Container } from 'pixi.js';
import type { Direction } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface KeyboardInputBindings {
    onDirectionChange(dir: Direction): void;
    onRestartChange(pressed: boolean): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createKeyboardPlayerInputView(bindings: KeyboardInputBindings): Container {
    const view = new Container();
    view.label = 'keyboard-player-input';

    function onKeyDown(e: KeyboardEvent): void {
        const dir = KEY_MAP[e.key];
        if (dir !== undefined) {
            e.preventDefault();
            bindings.onDirectionChange(dir);
            return;
        }
        if (e.key === 'Enter') {
            bindings.onRestartChange(true);
        }
    }

    window.addEventListener('keydown', onKeyDown);

    function onKeyUp(e: KeyboardEvent): void {
        if (e.key === 'Enter') {
            bindings.onRestartChange(false);
        }
    }

    window.addEventListener('keyup', onKeyUp);

    const originalDestroy = view.destroy.bind(view);
    view.destroy = (options) => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        originalDestroy(options);
    };

    return view;
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
