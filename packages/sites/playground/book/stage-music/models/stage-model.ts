// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long a stage lasts, in ms. */
const STAGE_MS = 12000;
/** How much time is left when the game starts hurrying the player, in ms. */
const HURRY_MS = 4000;
/** How long the game stays over before it returns to its title, in ms. */
const GAME_OVER_MS = 3000;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Where the game is: on its title, playing a stage, or over. */
export type GamePhase = 'title' | 'playing' | 'game-over';

/**
 * A game of timed stages. A stage starts from the title, and lasts a fixed
 * time. The game is over when the time runs out, and returns to its title
 * a moment later. The model says what phase the game is in, and whether
 * time is running short. Which music plays is up to the views.
 */
export interface StageModel {
    readonly phase: GamePhase;
    /** The time left in the stage, in ms. */
    readonly timeLeftMs: number;
    /** Whether the stage's time is running short. */
    readonly isHurrying: boolean;
    /** Starts a stage, if the game is on its title. */
    readonly startStage: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a game on its title. */
export function createStageModel(): StageModel {
    let phase: GamePhase = 'title';
    let timeLeftMs = STAGE_MS;
    // How long the game has been over, in ms
    let overMs = 0;

    const model: StageModel = {
        get phase() { return phase; },
        get timeLeftMs() { return timeLeftMs; },
        get isHurrying() { return phase === 'playing' && timeLeftMs <= HURRY_MS; },

        startStage() {
            if (phase !== 'title') return;
            phase = 'playing';
            timeLeftMs = STAGE_MS;
        },

        update(deltaMs) {
            if (phase === 'playing') {
                timeLeftMs = Math.max(0, timeLeftMs - deltaMs);
                if (timeLeftMs === 0) {
                    phase = 'game-over';
                    overMs = 0;
                }
            }
            else if (phase === 'game-over') {
                overMs += deltaMs;
                if (overMs >= GAME_OVER_MS) phase = 'title';
            }
        },
    };

    return model;
}
