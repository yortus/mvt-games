// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface BulletModel {
    /** World column position in tile units. */
    readonly worldCol: number;
    /** World row position in tile units. */
    readonly worldRow: number;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BulletModelOptions {
    readonly worldCol: number;
    readonly worldRow: number;
    /** Rightward speed in tiles per second. */
    readonly speed: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBulletModel(options: BulletModelOptions): BulletModel {
    const { speed } = options;

    let worldCol = options.worldCol;
    const worldRow = options.worldRow;

    const model: BulletModel = {
        get worldCol() {
            return worldCol;
        },
        get worldRow() {
            return worldRow;
        },

        update(deltaMs: number): void {
            worldCol += speed * deltaMs * 0.001;
        },
    };

    return model;
}
