// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long each level lasts, in ms. */
const LEVEL_MS = 2000;
/** How many levels there are. Level 1's grid is 3 by 3, and each level adds a row and a column. */
const LEVEL_COUNT = 4;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A game that moves on to a new level every few seconds, on its own. Each
 * level's grid is a size bigger than the last, and after the last level it
 * starts again at level 1.
 */
export interface LevelModel {
    /** The level, from 1. */
    readonly level: number;
    readonly rows: number;
    readonly cols: number;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a game at level 1, with a 3 by 3 grid. */
export function createLevelModel(): LevelModel {
    let level = 1;
    let elapsedMs = 0;

    const model: LevelModel = {
        get level() { return level; },
        get rows() { return level + 2; },
        get cols() { return level + 2; },

        update(deltaMs) {
            elapsedMs += deltaMs;
            if (elapsedMs < LEVEL_MS) return;
            elapsedMs -= LEVEL_MS;
            level = level < LEVEL_COUNT ? level + 1 : 1;
        },
    };

    return model;
}
