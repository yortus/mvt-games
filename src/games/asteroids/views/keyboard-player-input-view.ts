import { Container } from 'pixi.js';
import type { RotationDirection, PlayerInputModel } from '../models';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const ROTATION_MAP: Record<string, RotationDirection> = {
    ArrowLeft: 'rotate-left',
    ArrowRight: 'rotate-right',
    a: 'rotate-left',
    d: 'rotate-right',
};

/** Reverse lookup: direction → all keys that map to it. */
const DIR_KEYS: Record<RotationDirection, string[]> = {
    'none': [],
    'rotate-left': ['ArrowLeft', 'a'],
    'rotate-right': ['ArrowRight', 'd'],
};

export function createKeyboardPlayerInputView(playerInput: PlayerInputModel): Container {
    const container = new Container();
    container.label = 'keyboard-player-input';

    /** Set of currently held rotation keys. */
    const heldKeys = new Set<string>();

    function onKeyDown(e: KeyboardEvent): void {
        const rot = ROTATION_MAP[e.key];
        if (rot !== undefined) {
            e.preventDefault();
            heldKeys.add(e.key);
            playerInput.rotation = rot;
            return;
        }
        if (e.key === 'ArrowUp' || e.key === 'w') {
            e.preventDefault();
            playerInput.thrustPressed = true;
            return;
        }
        if (e.key === ' ') {
            e.preventDefault();
            playerInput.firePressed = true;
            return;
        }
        if (e.key === 'Enter') {
            playerInput.restartRequested = true;
        }
    }

    function onKeyUp(e: KeyboardEvent): void {
        if (e.key === ' ') {
            e.preventDefault();
            playerInput.firePressed = false;
            return;
        }
        if (e.key === 'ArrowUp' || e.key === 'w') {
            e.preventDefault();
            playerInput.thrustPressed = false;
            return;
        }
        const rot = ROTATION_MAP[e.key];
        if (rot !== undefined) {
            e.preventDefault();
            heldKeys.delete(e.key);
            if (playerInput.rotation === rot) {
                playerInput.rotation = findHeldRotation();
            }
        }
    }

    function findHeldRotation(): RotationDirection {
        const dirs: RotationDirection[] = ['rotate-left', 'rotate-right'];
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
