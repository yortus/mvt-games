// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface FuelTankModel {
    /** World column position in tile units. */
    readonly worldCol: number;
    /** World row position in tile units. */
    readonly worldRow: number;
    /** Whether the fuel tank is alive (active and not destroyed). */
    readonly isAlive: boolean;
    /** Whether the fuel tank is currently in use (placed in the world). */
    readonly isActive: boolean;
    /** Place the fuel tank in the world at the given position. */
    activate(worldCol: number, worldRow: number): void;
    /** Remove the fuel tank from the world. */
    deactivate(): void;
    /** Destroy the fuel tank (killed by player). */
    kill(): void;
    /** Advance fuel tank state (stationary - no-op). */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFuelTankModel(): FuelTankModel {
    let worldCol = 0;
    let worldRow = 0;
    let alive = false;
    let active = false;

    const model: FuelTankModel = {
        get worldCol() {
            return worldCol;
        },
        get worldRow() {
            return worldRow;
        },
        get isAlive() {
            return alive;
        },
        get isActive() {
            return active;
        },

        activate(col: number, row: number): void {
            worldCol = col;
            worldRow = row;
            alive = true;
            active = true;
        },

        deactivate(): void {
            alive = false;
            active = false;
        },

        kill(): void {
            alive = false;
            active = false;
        },

        update(_deltaMs: number): void {
            // Fuel tanks are stationary
        },
    };

    return model;
}
