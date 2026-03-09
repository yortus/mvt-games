import { Container } from 'pixi.js';
import type { Direction, PlayerInputModel } from '../models';

// ---------------------------------------------------------------------------
// Factory
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

/** Reverse lookup: direction → all keys that map to it. */
const DIR_KEYS: Record<Direction, string[]> = {
    none: [],
    up: ['ArrowUp', 'w'],
    down: ['ArrowDown', 's'],
    left: ['ArrowLeft', 'a'],
    right: ['ArrowRight', 'd'],
};

export function createKeyboardPlayerInputView(playerInput: PlayerInputModel): Container {
    const container = new Container();
    container.label = 'keyboard-player-input';

    /** Set of currently held direction keys. */
    const heldKeys = new Set<string>();

    function onKeyDown(e: KeyboardEvent): void {
        const dir = KEY_MAP[e.key];
        if (dir !== undefined) {
            e.preventDefault();
            heldKeys.add(e.key);
            playerInput.direction = dir;
            return;
        }
        if (e.key === ' ') {
            e.preventDefault();
            playerInput.pumpPressed = true;
            return;
        }
        if (e.key === 'Enter') {
            playerInput.restartRequested = true;
        }
    }

    function onKeyUp(e: KeyboardEvent): void {
        if (e.key === ' ') {
            e.preventDefault();
            playerInput.pumpPressed = false;
            return;
        }
        const dir = KEY_MAP[e.key];
        if (dir !== undefined) {
            e.preventDefault();
            heldKeys.delete(e.key);
            // If this was the active direction, check if another direction key is still held
            if (playerInput.direction === dir) {
                playerInput.direction = findHeldDirection();
            }
        }
    }

    function findHeldDirection(): Direction {
        // Check each direction for any still-held key
        const dirs: Direction[] = ['up', 'down', 'left', 'right'];
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
