// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A stand-in for a game that pays out: round after round, nothing is won
 * for a moment, and then the same amount is.
 */
export interface WinRoundModel {
    /** What this round has won so far: 0 at first, then the win. */
    readonly amount: number;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WinRoundModelOptions {
    /** What each round wins. */
    readonly win: number;
    /** How long each round lasts, in ms. */
    readonly roundMs: number;
    /** How long into each round the win comes, in ms. */
    readonly winAtMs: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a round, just started, that hasn't won yet. */
export function createWinRoundModel({ win, roundMs, winAtMs }: WinRoundModelOptions): WinRoundModel {
    // How far into this round the game is, in ms
    let roundElapsedMs = 0;

    const model: WinRoundModel = {
        get amount() { return roundElapsedMs >= winAtMs ? win : 0; },

        update(deltaMs) {
            roundElapsedMs = (roundElapsedMs + deltaMs) % roundMs;
        },
    };

    return model;
}
