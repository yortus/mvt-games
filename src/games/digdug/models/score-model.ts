// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ScoreModel {
    readonly score: number;
    readonly lives: number;
    readonly level: number;
    addPoints(amount: number): void;
    /** Lose a life. Returns false if no lives remain. */
    loseLife(): boolean;
    advanceLevel(): void;
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
    let level = 1;

    const model: ScoreModel = {
        get score() {
            return score;
        },
        get lives() {
            return lives;
        },
        get level() {
            return level;
        },

        addPoints(amount: number): void {
            score += amount;
        },

        loseLife(): boolean {
            lives--;
            return lives > 0;
        },

        advanceLevel(): void {
            level++;
        },

        reset(): void {
            score = 0;
            lives = initialLives;
            level = 1;
        },

        update(_deltaMs: number): void {
            // No time-based behaviour
        },
    };

    return model;
}
