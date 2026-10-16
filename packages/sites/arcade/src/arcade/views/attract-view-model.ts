// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Attract mode, for the wall: which card plays its entry live. A card that
 * stays the candidate (the selected card, while previews are allowed) for a
 * while plays; the moment another card is the candidate, or none is, it
 * stops, and the new one waits its turn. One card at a time.
 */
export interface AttractViewModel {
    /** The card playing its entry live, or -1. */
    readonly index: number;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface AttractViewModelOptions {
    /** The card that would play if it stayed the candidate long enough, or -1. */
    readonly candidate: () => number;
    /** How long a card must stay the candidate before it plays, in milliseconds. */
    readonly delayMs: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAttractViewModel(options: AttractViewModelOptions): AttractViewModel {
    let candidate = -1;
    let waitedMs = 0;

    return {
        get index() {
            return candidate >= 0 && waitedMs >= options.delayMs ? candidate : -1;
        },

        update(deltaMs) {
            const next = options.candidate();
            if (next !== candidate) {
                candidate = next;
                waitedMs = 0;
                return;
            }
            if (candidate >= 0) waitedMs += deltaMs;
        },
    };
}
