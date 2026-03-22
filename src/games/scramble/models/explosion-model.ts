// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ExplosionModel {
    /** World column position in tile units. */
    readonly worldCol: number;
    /** World row position in tile units. */
    readonly worldRow: number;
    /** Whether this explosion is currently active (animating). */
    readonly isActive: boolean;
    /** Progress from 0 (just started) to 1 (finished). */
    readonly progress: number;
    /** Trigger an explosion at the given position. */
    spawn(worldCol: number, worldRow: number): void;
    /** Advance the explosion timer. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ExplosionModelOptions {
    /** Duration of the explosion in ms. */
    readonly durationMs: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createExplosionModel(options: ExplosionModelOptions): ExplosionModel {
    const { durationMs } = options;

    let worldCol = 0;
    let worldRow = 0;
    let active = false;
    let elapsed = 0;

    const model: ExplosionModel = {
        get worldCol() {
            return worldCol;
        },
        get worldRow() {
            return worldRow;
        },
        get isActive() {
            return active;
        },
        get progress() {
            if (!active) return 0;
            return elapsed / durationMs;
        },

        spawn(col: number, row: number): void {
            worldCol = col;
            worldRow = row;
            active = true;
            elapsed = 0;
        },

        update(deltaMs: number): void {
            if (!active) return;
            elapsed += deltaMs;
            if (elapsed >= durationMs) {
                active = false;
            }
        },
    };

    return model;
}
