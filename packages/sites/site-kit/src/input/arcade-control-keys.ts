import type { ArcadeControl } from './arcade-controls';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The keys for each arcade control, as `KeyboardEvent.key` names them.
 * Several keys can be for one control. A letter listed in lower case works
 * with Shift or Caps Lock too.
 */
export type ArcadeControlKeys = Readonly<Record<ArcadeControl, readonly string[]>>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The keys for the arcade controls. They are the arrows or WASD, then Space, Shift and Enter. */
export const ARCADE_CONTROL_KEYS: ArcadeControlKeys = {
    left: ['ArrowLeft', 'a'],
    right: ['ArrowRight', 'd'],
    up: ['ArrowUp', 'w'],
    down: ['ArrowDown', 's'],
    primary: [' '],
    secondary: ['Shift'],
    restart: ['Enter'],
};
