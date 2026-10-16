// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A stationary ground target. Also used for the base at the end of the last section. */
export interface FuelTankModel {
    /** World column position in tile units. */
    readonly worldCol: number;
    /** World row position in tile units. */
    readonly worldRow: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FuelTankModelOptions {
    readonly worldCol: number;
    readonly worldRow: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFuelTankModel(options: FuelTankModelOptions): FuelTankModel {
    const { worldCol, worldRow } = options;

    const model: FuelTankModel = {
        get worldCol() {
            return worldCol;
        },
        get worldRow() {
            return worldRow;
        },
    };

    return model;
}
