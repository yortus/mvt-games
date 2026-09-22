// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface BombModel {
    /** World column position in tile units. */
    readonly worldCol: number;
    /** World row position in tile units. */
    readonly worldRow: number;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BombModelOptions {
    readonly worldCol: number;
    readonly worldRow: number;
    /** Horizontal speed in tiles per second. */
    readonly vCol: number;
    /** Gravity in tiles per second squared. */
    readonly gravity: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBombModel(options: BombModelOptions): BombModel {
    const { vCol, gravity } = options;

    let worldCol = options.worldCol;
    let worldRow = options.worldRow;
    let vRow = 0;

    const model: BombModel = {
        get worldCol() {
            return worldCol;
        },
        get worldRow() {
            return worldRow;
        },

        update(deltaMs: number): void {
            const dt = deltaMs * 0.001;
            vRow += gravity * dt;
            worldRow += vRow * dt;
            worldCol += vCol * dt;
        },
    };

    return model;
}
