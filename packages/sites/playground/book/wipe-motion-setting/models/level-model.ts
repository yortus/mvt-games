// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long each level plays before the wipe, in ms. */
const LEVEL_MS = 2500;
/** How long the wipe takes, in ms. */
const WIPE_MS = 1400;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the game is doing: playing a level, or wiping across to the next. */
export type LevelPhase = 'playing' | 'wiping';

/**
 * A game of levels. Each level plays for a few seconds, then the game wipes
 * across to the next. The level changes half way through the wipe. The wipe
 * decides when the next level starts, so its timing belongs here, as a
 * phase and a progress. How the wipe looks is up to the views.
 */
export interface LevelModel {
    readonly level: number;
    readonly phase: LevelPhase;
    /** How far through the wipe the game is, from 0 to 1, and 0 while playing. */
    readonly progress: number;
    /** Ends the level now, and starts the wipe, if a level is playing. */
    readonly endLevel: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a game playing its first level. */
export function createLevelModel(): LevelModel {
    let level = 1;
    let phase: LevelPhase = 'playing';
    // How long the game has been in this phase, in ms
    let phaseMs = 0;

    const model: LevelModel = {
        get level() { return level; },
        get phase() { return phase; },
        get progress() { return phase === 'wiping' ? Math.min(phaseMs / WIPE_MS, 1) : 0; },

        endLevel() {
            if (phase !== 'playing') return;
            phase = 'wiping';
            phaseMs = 0;
        },

        update(deltaMs) {
            const wasPastHalf = phaseMs >= WIPE_MS / 2;
            phaseMs += deltaMs;
            if (phase === 'playing') {
                if (phaseMs >= LEVEL_MS) model.endLevel();
                return;
            }
            // The next level starts behind the wipe, half way through it
            if (!wasPastHalf && phaseMs >= WIPE_MS / 2) level += 1;
            if (phaseMs >= WIPE_MS) {
                phase = 'playing';
                phaseMs = 0;
            }
        },
    };

    return model;
}
