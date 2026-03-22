// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface BombModel {
    /** World column position in tile units. */
    readonly worldCol: number;
    /** World row position in tile units. */
    readonly worldRow: number;
    /** Whether this bomb is currently in flight. */
    readonly isActive: boolean;
    /** Drop the bomb from a position with a given horizontal velocity. */
    fire(worldCol: number, worldRow: number, vCol: number): void;
    /** Deactivate the bomb immediately. */
    deactivate(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BombModelOptions {
    /** Gravity in tiles per second squared. */
    readonly gravity: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBombModel(options: BombModelOptions): BombModel {
    const { gravity } = options;

    let worldCol = 0;
    let worldRow = 0;
    let vCol = 0;
    let vRow = 0;
    let active = false;

    const model: BombModel = {
        get worldCol() {
            return worldCol;
        },
        get worldRow() {
            return worldRow;
        },
        get isActive() {
            return active;
        },

        fire(col: number, row: number, horizontalSpeed: number): void {
            worldCol = col;
            worldRow = row;
            vCol = horizontalSpeed;
            vRow = 0;
            active = true;
        },

        deactivate(): void {
            active = false;
        },

        update(deltaMs: number): void {
            if (!active) return;

            const dt = deltaMs * 0.001;
            vRow += gravity * dt;
            worldRow += vRow * dt;
            worldCol += vCol * dt;
        },
    };

    return model;
}
