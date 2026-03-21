// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface BulletModel {
    /** World column position in tile units. */
    readonly worldCol: number;
    /** World row position in tile units. */
    readonly worldRow: number;
    /** Whether this bullet is currently in flight. */
    readonly active: boolean;
    /** Activate the bullet at a position, traveling rightward at the given speed. */
    fire(worldCol: number, worldRow: number, speed: number): void;
    /** Deactivate the bullet immediately. */
    deactivate(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBulletModel(): BulletModel {
    let worldCol = 0;
    let worldRow = 0;
    let speed = 0;
    let active = false;

    const model: BulletModel = {
        get worldCol() {
            return worldCol;
        },
        get worldRow() {
            return worldRow;
        },
        get active() {
            return active;
        },

        fire(col: number, row: number, spd: number): void {
            worldCol = col;
            worldRow = row;
            speed = spd;
            active = true;
        },

        deactivate(): void {
            active = false;
        },

        update(deltaMs: number): void {
            if (!active) return;
            worldCol += speed * deltaMs * 0.001;
        },
    };

    return model;
}
