import type { ArcadeControls } from '../input';
import { createRandom } from '../random';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Plays a game badly, for its attract mode. Every so often it picks a new
 * direction to hold, and whether to hold the primary button, so the game
 * looks as if someone is having a go.
 */
export interface AttractPilot {
    /** Moves on by `deltaMs`, and sets what's held on `controls`, from the `'script'` source. */
    readonly steer: (controls: ArcadeControls, deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface AttractPilotOptions {
    /** The seed for its choices, so each screen plays its own way. */
    readonly seed: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a pilot that makes its first choice on its first step. */
export function createAttractPilot({ seed }: AttractPilotOptions): AttractPilot {
    const random = createRandom({ seed });
    let untilChangeMs = 0;
    let xDirection: 'left' | 'none' | 'right' = 'none';
    let yDirection: 'up' | 'none' | 'down' = 'none';
    let isPrimaryHeld = false;

    return {
        steer(controls, deltaMs) {
            untilChangeMs -= deltaMs;
            if (untilChangeMs <= 0) {
                untilChangeMs = random.between(MIN_HOLD_MS, MAX_HOLD_MS);
                xDirection = X_DIRECTIONS[random.nextIndex(X_DIRECTIONS.length)];
                yDirection = Y_DIRECTIONS[random.nextIndex(Y_DIRECTIONS.length)];
                isPrimaryHeld = random.next() < PRIMARY_SHARE;
            }
            controls.setXDirection('script', xDirection);
            controls.setYDirection('script', yDirection);
            controls.setHeld('script', 'primary', isPrimaryHeld);
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long each choice is held. */
const MIN_HOLD_MS = 250;
const MAX_HOLD_MS = 1000;
/** The choices. Repeats make some likelier, so it mostly goes forward or holds still, which suits most games. */
const X_DIRECTIONS = ['left', 'none', 'right', 'none'] as const;
const Y_DIRECTIONS = ['up', 'up', 'none', 'none', 'down'] as const;
/** How often the primary button is held. */
const PRIMARY_SHARE = 0.55;
