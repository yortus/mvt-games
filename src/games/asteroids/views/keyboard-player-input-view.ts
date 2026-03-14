import { Container } from 'pixi.js';
import type { RotationDirection } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface KeyboardInputBindings {
    onRotationChange?(rot: RotationDirection): void;
    onThrustChange?(pressed: boolean): void;
    onFireChange?(pressed: boolean): void;
    onRestartChange?(pressed: boolean): void;
}

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

export function createKeyboardPlayerInputView(bindings: KeyboardInputBindings): Container {
    const view = new Container();
    view.label = 'keyboard-player-input';

    /** Set of currently held rotation keys. */
    const heldKeys = new Set<string>();

    /** Current rotation reported to the model. */
    let currentRotation: RotationDirection = 'none';

    function onKeyDown(e: KeyboardEvent): void {
        const rot = ROTATION_MAP[e.key];
        if (rot !== undefined) {
            e.preventDefault();
            heldKeys.add(e.key);
            currentRotation = rot;
            bindings.onRotationChange?.(rot);
            return;
        }
        if (e.key === 'ArrowUp' || e.key === 'w') {
            e.preventDefault();
            bindings.onThrustChange?.(true);
            return;
        }
        if (e.key === ' ') {
            e.preventDefault();
            bindings.onFireChange?.(true);
            return;
        }
        if (e.key === 'Enter') {
            bindings.onRestartChange?.(true);
        }
    }

    function onKeyUp(e: KeyboardEvent): void {
        if (e.key === ' ') {
            e.preventDefault();
            bindings.onFireChange?.(false);
            return;
        }
        if (e.key === 'ArrowUp' || e.key === 'w') {
            e.preventDefault();
            bindings.onThrustChange?.(false);
            return;
        }
        if (e.key === 'Enter') {
            bindings.onRestartChange?.(false);
            return;
        }
        const rot = ROTATION_MAP[e.key];
        if (rot !== undefined) {
            e.preventDefault();
            heldKeys.delete(e.key);
            if (currentRotation === rot) {
                currentRotation = findHeldRotation();
                bindings.onRotationChange?.(currentRotation);
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

    const originalDestroy = view.destroy.bind(view);
    view.destroy = (options) => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        originalDestroy(options);
    };

    return view;
}
