// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long the shield stays up once it's raised, in ms. */
const SHIELD_MS = 3000;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A shield that protects the player for three seconds once it's raised.
 * It keeps time only through `update(deltaMs)`, so when nothing calls
 * `update`, as while the game is paused, the shield waits.
 */
export interface ShieldModel {
    readonly isRaised: boolean;
    /** Raises the shield for its full time, even if it's already up. */
    readonly raise: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a shield that's down. */
export function createShieldModel(): ShieldModel {
    let remainingMs = 0;

    return {
        get isRaised() { return remainingMs > 0; },
        raise() { remainingMs = SHIELD_MS; },
        update(deltaMs) {
            remainingMs = Math.max(0, remainingMs - deltaMs);
        },
    };
}
