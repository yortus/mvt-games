// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ExplosionModel {
    /** World column position in tile units. */
    readonly worldCol: number;
    /** World row position in tile units. */
    readonly worldRow: number;
    /** Progress from 0 (just started) to 1 (finished). */
    readonly progress: number;
    /** Advance the explosion timer. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ExplosionModelOptions {
    readonly worldCol: number;
    readonly worldRow: number;
    /** Duration of the explosion in ms. */
    readonly durationMs: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createExplosionModel(options: ExplosionModelOptions): ExplosionModel {
    const { worldCol, worldRow, durationMs } = options;

    let elapsed = 0;

    const model: ExplosionModel = {
        get worldCol() {
            return worldCol;
        },
        get worldRow() {
            return worldRow;
        },
        get progress() {
            return elapsed / durationMs;
        },

        update(deltaMs: number): void {
            elapsed = Math.min(elapsed + deltaMs, durationMs);
        },
    };

    return model;
}
