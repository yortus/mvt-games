import { Container } from 'pixi.js';
import type { Direction } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface KeyboardInputBindings {
    onDirectionChange(dir: Direction): void;
    onFireChange(pressed: boolean): void;
    onRestartRequest(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const KEY_MAP: Record<string, Direction> = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    a: 'left',
    d: 'right',
};

/** Reverse lookup: direction → all keys that map to it. */
const DIR_KEYS: Record<Direction, string[]> = {
    none: [],
    left: ['ArrowLeft', 'a'],
    right: ['ArrowRight', 'd'],
};

export function createKeyboardPlayerInputView(bindings: KeyboardInputBindings): Container {
    const container = new Container();
    container.label = 'keyboard-player-input';

    /** Set of currently held direction keys. */
    const heldKeys = new Set<string>();

    /** Current direction reported to the model. */
    let currentDirection: Direction = 'none';

    function onKeyDown(e: KeyboardEvent): void {
        const dir = KEY_MAP[e.key];
        if (dir !== undefined) {
            e.preventDefault();
            heldKeys.add(e.key);
            currentDirection = dir;
            bindings.onDirectionChange(dir);
            return;
        }
        if (e.key === ' ') {
            e.preventDefault();
            bindings.onFireChange(true);
            return;
        }
        if (e.key === 'Enter') {
            bindings.onRestartRequest();
        }
    }

    function onKeyUp(e: KeyboardEvent): void {
        if (e.key === ' ') {
            e.preventDefault();
            bindings.onFireChange(false);
            return;
        }
        const dir = KEY_MAP[e.key];
        if (dir !== undefined) {
            e.preventDefault();
            heldKeys.delete(e.key);
            if (currentDirection === dir) {
                currentDirection = findHeldDirection();
                bindings.onDirectionChange(currentDirection);
            }
        }
    }

    function findHeldDirection(): Direction {
        const dirs: Direction[] = ['left', 'right'];
        for (let d = 0; d < dirs.length; d++) {
            const keys = DIR_KEYS[dirs[d]];
            for (let k = 0; k < keys.length; k++) {
                if (heldKeys.has(keys[k])) return dirs[d];
            }
        }
        return 'none';
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const originalDestroy = container.destroy.bind(container);
    container.destroy = (options) => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        originalDestroy(options);
    };

    return container;
}
