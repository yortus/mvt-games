// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ScoreModel {
    readonly score: number;
    readonly lives: number;
    readonly stage: number;
    addPoints(amount: number): void;
    /** Lose a life. Returns false if no lives remain. */
    loseLife(): boolean;
    advanceStage(): void;
    reset(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ScoreModelOptions {
    readonly initialLives?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createScoreModel(options: ScoreModelOptions = {}): ScoreModel {
    const { initialLives = 3 } = options;

    let score = 0;
    let lives = initialLives;
    let stage = 1;

    const model: ScoreModel = {
        get score() {
            return score;
        },
        get lives() {
            return lives;
        },
        get stage() {
            return stage;
        },

        addPoints(amount: number): void {
            score += amount;
        },

        loseLife(): boolean {
            lives--;
            return lives > 0;
        },

        advanceStage(): void {
            stage++;
        },

        reset(): void {
            score = 0;
            lives = initialLives;
            stage = 1;
        },

        update(_deltaMs: number): void {
            // No time-based behaviour
        },
    };

    return model;
}
