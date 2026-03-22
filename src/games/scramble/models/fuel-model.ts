// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface FuelModel {
    /** Current fuel level (0.0 to 1.0). */
    readonly fuel: number;
    /** Whether fuel has been depleted to zero. */
    readonly isFuelEmpty: boolean;
    /** Add fuel, capped at 1.0. */
    addFuel(amount: number): void;
    reset(): void;
    /** Advance fuel depletion. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FuelModelOptions {
    /** Fuel depletion rate per second (full tank = 1.0). */
    readonly fuelDepletionRate?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFuelModel(options: FuelModelOptions = {}): FuelModel {
    const { fuelDepletionRate = 0.03 } = options;

    let fuel = 1.0;
    let fuelEmpty = false;

    const model: FuelModel = {
        get fuel() {
            return fuel;
        },
        get isFuelEmpty() {
            return fuelEmpty;
        },

        addFuel(amount: number): void {
            fuel += amount;
            if (fuel > 1.0) fuel = 1.0;
        },

        reset(): void {
            fuel = 1.0;
            fuelEmpty = false;
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
