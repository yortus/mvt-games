// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ScoreModel {
    readonly score: number;
    addPoints(amount: number): void;
    reset(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createScoreModel(): ScoreModel {
    let score = 0;

    const model: ScoreModel = {
        get score() {
            return score;
        },

        addPoints(amount: number): void {
            score += amount;
        },

        reset(): void {
            score = 0;
        },

        update(_deltaMs: number): void {
            // No time-based behaviour
        },
    };

    return model;
}
