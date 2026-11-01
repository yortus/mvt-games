// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long the hunt takes to find a gem on its own, in ms. */
const FIND_EVERY_MS = 1500;
/** The gems' values, in points, in the order they're found, round and round. */
const GEM_VALUES: readonly number[] = [100, 250, 50, 500, 150];

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A hunt for gems, which plays itself: it finds a gem every second and a
 * half, and the player can dig one up sooner. Each gem adds its value to the
 * score at once, in one step.
 */
export interface GemModel {
    readonly score: number;
    /** Finds the next gem now, and adds its value to the score. */
    readonly findGem: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a hunt with a score of 0. */
export function createGemModel(): GemModel {
    let score = 0;
    let gemsFound = 0;
    let elapsedMs = 0;

    const model: GemModel = {
        get score() { return score; },

        findGem() {
            score += GEM_VALUES[gemsFound % GEM_VALUES.length];
            gemsFound += 1;
            elapsedMs = 0;
        },

        update(deltaMs) {
            elapsedMs += deltaMs;
            if (elapsedMs >= FIND_EVERY_MS) model.findGem();
        },
    };

    return model;
}
