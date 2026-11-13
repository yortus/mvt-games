import type { ArcadeControlKeys } from './arcade-control-keys';
import { listenToKeys } from './listen-to-keys';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** One of the arcade controls. Each is a direction on the d-pad, one of the two buttons, or Restart. */
export type ArcadeControl = 'left' | 'right' | 'up' | 'down' | 'primary' | 'secondary' | 'restart';

/**
 * Where a control is held from. It can be the keyboard or the touch
 * controls. It can also be a script, such as a thumbnail's input. Each
 * source is counted on its own. So a control stays held while any source
 * holds it.
 */
export type ArcadeControlSource = 'keyboard' | 'touch' | 'script';

/** Where the arcade controls report. Each control is reported only as it changes. */
export interface ArcadeControlsListener {
    /** The direction held left or right has changed. */
    readonly onXDirectionChanged?: (direction: 'left' | 'none' | 'right') => void;
    /** The direction held up or down has changed. */
    readonly onYDirectionChanged?: (direction: 'up' | 'none' | 'down') => void;
    readonly onPrimaryButtonChanged?: (pressed: boolean) => void;
    readonly onSecondaryButtonChanged?: (pressed: boolean) => void;
    readonly onRestartButtonChanged?: (pressed: boolean) => void;
}

/**
 * The arcade controls. They are a d-pad, two buttons and Restart, like the
 * stick and buttons on an arcade cabinet. They are virtual. The player holds
 * them from the keyboard or from the host's on-screen controls. A game's
 * wiring defines what each one means.
 */
export interface ArcadeControls {
    /** The direction held left or right. With both held, the one pressed last wins. */
    readonly xDirection: 'left' | 'none' | 'right';
    /** The direction held up or down. With both held, the one pressed last wins. */
    readonly yDirection: 'up' | 'none' | 'down';
    /** Whether `control` is held from any source. */
    readonly isHeld: (control: ArcadeControl) => boolean;
    /** Sets whether `control` is held from `source`. */
    readonly setHeld: (source: ArcadeControlSource, control: ArcadeControl, isHeld: boolean) => void;
    /** Sets the direction held left or right from `source`, or neither, as a d-pad reports it. */
    readonly setXDirection: (source: ArcadeControlSource, direction: 'left' | 'none' | 'right') => void;
    /** Sets the direction held up or down from `source`, or neither, as a d-pad reports it. */
    readonly setYDirection: (source: ArcadeControlSource, direction: 'up' | 'none' | 'down') => void;
    /**
     * Reports each change to `listener` from now on, and returns a function
     * that stops. It reports nothing as it starts, even for a control already
     * held, since it may be called during a frame.
     */
    readonly listen: (listener: ArcadeControlsListener) => () => void;
    /** Stops listening to the keyboard, and stops reporting to every listener. */
    readonly destroy: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ArcadeControlsOptions {
    /** The keys for each control. Without them, it doesn't listen to the keyboard. */
    readonly keys?: ArcadeControlKeys;
    /**
     * Whether key presses are handled. For example, they aren't while the
     * game is paused. A key released still counts when presses aren't
     * handled. So a key held across a pause stays held, and a key released
     * during one is released.
     */
    readonly isActive?: () => boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the arcade controls, and listens to the keys in `options.keys`
 * until they are destroyed.
 *
 * They report only from within the call that changed them. That call is a
 * key event's listener, or a call to `setHeld`. So they report between
 * frames whenever their callers do. Creating them, listening to them,
 * destroying them and pausing the game report nothing. The page does all
 * four during its frame.
 */
export function createArcadeControls(options: ArcadeControlsOptions = {}): ArcadeControls {
    // For each control, a bit for each source it is held from
    const holders: Record<ArcadeControl, number> = { left: 0, right: 0, up: 0, down: 0, primary: 0, secondary: 0, restart: 0 };
    // The direction on each axis pressed last. It wins while both are held
    let latestX: 'left' | 'right' = 'left';
    let latestY: 'up' | 'down' = 'up';
    let xDirection: 'left' | 'none' | 'right' = 'none';
    let yDirection: 'up' | 'none' | 'down' = 'none';
    const listeners: ArcadeControlsListener[] = [];

    const keys = options.keys;
    const stopKeys = keys === undefined
        ? undefined
        : listenToKeys<ArcadeControl>({
                isActive: options.isActive ?? (() => true),
                pressed: {},
                repeating: {},
                held: toHeldTable(keys),
                onHeldChanged: (isKeyHeld) => {
                    for (let i = 0; i < CONTROLS.length; i++) setHeld('keyboard', CONTROLS[i], isKeyHeld(CONTROLS[i]));
                },
            });

    const controls: ArcadeControls = {
        get xDirection() {
            return xDirection;
        },
        get yDirection() {
            return yDirection;
        },
        isHeld: (control) => holders[control] !== 0,
        setHeld,

        setXDirection(source, direction) {
            // The new direction is set before the old one is released, so the axis never passes through 'none'
            if (direction !== 'none') setHeld(source, direction, true);
            if (direction !== 'left') setHeld(source, 'left', false);
            if (direction !== 'right') setHeld(source, 'right', false);
        },

        setYDirection(source, direction) {
            if (direction !== 'none') setHeld(source, direction, true);
            if (direction !== 'up') setHeld(source, 'up', false);
            if (direction !== 'down') setHeld(source, 'down', false);
        },

        listen(listener) {
            listeners.push(listener);
            return () => {
                const index = listeners.indexOf(listener);
                if (index >= 0) listeners.splice(index, 1);
            };
        },

        destroy() {
            // The listeners are removed first, so the keys' release, which is reported later, calls none of them
            listeners.length = 0;
            stopKeys?.();
        },
    };

    return controls;

    function setHeld(source: ArcadeControlSource, control: ArcadeControl, isHeld: boolean): void {
        const bit = SOURCE_BITS[source];
        const wasHeld = holders[control] !== 0;
        holders[control] = isHeld ? holders[control] | bit : holders[control] & ~bit;
        // If it is still held from some source, or still held from none, nothing changed.
        // From here on, the hold equals isHeld
        if ((holders[control] !== 0) === wasHeld) return;
        switch (control) {
            case 'left':
            case 'right':
                if (isHeld) latestX = control;
                followX();
                return;
            case 'up':
            case 'down':
                if (isHeld) latestY = control;
                followY();
                return;
            case 'primary':
                for (let i = 0; i < listeners.length; i++) listeners[i].onPrimaryButtonChanged?.(isHeld);
                return;
            case 'secondary':
                for (let i = 0; i < listeners.length; i++) listeners[i].onSecondaryButtonChanged?.(isHeld);
                return;
            case 'restart':
                for (let i = 0; i < listeners.length; i++) listeners[i].onRestartButtonChanged?.(isHeld);
                return;
        }
    }

    function followX(): void {
        const left = holders.left !== 0;
        const right = holders.right !== 0;
        const next = left && right ? latestX : left ? 'left' : right ? 'right' : 'none';
        if (next === xDirection) return;
        xDirection = next;
        for (let i = 0; i < listeners.length; i++) listeners[i].onXDirectionChanged?.(next);
    }

    function followY(): void {
        const up = holders.up !== 0;
        const down = holders.down !== 0;
        const next = up && down ? latestY : up ? 'up' : down ? 'down' : 'none';
        if (next === yDirection) return;
        yDirection = next;
        for (let i = 0; i < listeners.length; i++) listeners[i].onYDirectionChanged?.(next);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CONTROLS: readonly ArcadeControl[] = ['left', 'right', 'up', 'down', 'primary', 'secondary', 'restart'];

/** Each source's bit in a control's holders. */
const SOURCE_BITS: Readonly<Record<ArcadeControlSource, number>> = { keyboard: 1 << 0, touch: 1 << 1, script: 1 << 2 };

/** The keys' table turned round, for `listenToKeys`: the control for each key. */
function toHeldTable(keys: ArcadeControlKeys): Record<string, ArcadeControl> {
    const held: Record<string, ArcadeControl> = {};
    for (let i = 0; i < CONTROLS.length; i++) {
        const control = CONTROLS[i];
        const controlKeys = keys[control];
        for (let j = 0; j < controlKeys.length; j++) held[controlKeys[j]] = control;
    }
    return held;
}
