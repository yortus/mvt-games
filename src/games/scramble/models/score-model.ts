// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ScoreModel {
    /** Current score. */
    readonly score: number;
    /** Remaining lives. */
    readonly lives: number;
    /** Current fuel level (0.0 to 1.0). */
    readonly fuel: number;
    /** Whether fuel has been depleted to zero. */
    readonly fuelEmpty: boolean;
    /** Current section index (0-based). */
    readonly sectionIndex: number;
    /** Current loop count (0-based, increments after completing all sections). */
    readonly loop: number;
    addPoints(amount: number): void;
    /** Lose a life. Returns false if no lives remain. */
    loseLife(): boolean;
    /** Add fuel, capped at 1.0. */
    addFuel(amount: number): void;
    /** Set the current section index. */
    setSectionIndex(index: number): void;
    /** Increment the loop counter. */
    advanceLoop(): void;
    reset(): void;
    /** Advance fuel depletion. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ScoreModelOptions {
    readonly initialLives?: number;
    /** Fuel depletion rate per second (full tank = 1.0). */
    readonly fuelDepletionRate?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createScoreModel(options: ScoreModelOptions = {}): ScoreModel {
    const { initialLives = 3, fuelDepletionRate = 0.03 } = options;

    let score = 0;
    let lives = initialLives;
    let fuel = 1.0;
    let fuelEmpty = false;
    let sectionIndex = 0;
    let loop = 0;

    const model: ScoreModel = {
        get score() {
            return score;
        },
        get lives() {
            return lives;
        },
        get fuel() {
            return fuel;
        },
        get fuelEmpty() {
            return fuelEmpty;
        },
        get sectionIndex() {
            return sectionIndex;
        },
        get loop() {
            return loop;
        },

        addPoints(amount: number): void {
            score += amount;
        },

        loseLife(): boolean {
            lives--;
            return lives > 0;
        },

        addFuel(amount: number): void {
            fuel += amount;
            if (fuel > 1.0) fuel = 1.0;
        },

        setSectionIndex(index: number): void {
            sectionIndex = index;
        },

        advanceLoop(): void {
            loop++;
        },

        reset(): void {
            score = 0;
            lives = initialLives;
            fuel = 1.0;
            fuelEmpty = false;
            sectionIndex = 0;
            loop = 0;
        },

        update(deltaMs: number): void {
            if (fuelEmpty) return;

            const dt = deltaMs * 0.001;
            fuel -= fuelDepletionRate * dt;
            if (fuel <= 0) {
                fuel = 0;
                fuelEmpty = true;
            }
        },
    };

    return model;
}
