// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long the shield stays up once it's raised, in ms. */
const SHIELD_MS = 3000;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The same shield, written the obvious way, with a timer. It's here only to
 * compare with the other one. Don't write models like this: `setTimeout`
 * counts on the wall clock, so the shield drops on time even while the game
 * is paused.
 */
export interface TimeoutShieldModel {
    readonly isRaised: boolean;
    /** Raises the shield, and starts a timer that lowers it. */
    readonly raise: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a shield that's down. */
export function createTimeoutShieldModel(): TimeoutShieldModel {
    let isRaised = false;

    return {
        get isRaised() { return isRaised; },
        raise() {
            isRaised = true;
            // eslint-disable-next-line @mvtjs/no-wall-clock -- the mistake this example shows
            setTimeout(() => {
                isRaised = false;
            }, SHIELD_MS); // the problem
        },
    };
}
