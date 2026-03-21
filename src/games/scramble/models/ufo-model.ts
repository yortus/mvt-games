// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface UfoModel {
    /** World column position in tile units. */
    readonly worldCol: number;
    /** World row position in tile units. */
    readonly worldRow: number;
    /** Whether the UFO is alive (active and not destroyed). */
    readonly alive: boolean;
    /** Whether the UFO is currently in use (placed in the world). */
    readonly active: boolean;
    /** Place the UFO in the world at the given position. */
    activate(worldCol: number, worldRow: number): void;
    /** Remove the UFO from the world. */
    deactivate(): void;
    /** Destroy the UFO (killed by player). */
    kill(): void;
    /** Advance UFO state - moves left with vertical sine oscillation. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UfoModelOptions {
    /** Leftward speed in tiles per second. */
    readonly speed: number;
    /** Vertical oscillation amplitude in tiles. */
    readonly oscillationAmp: number;
    /** Vertical oscillation frequency in Hz. */
    readonly oscillationFreq: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createUfoModel(options: UfoModelOptions): UfoModel {
    const { speed, oscillationAmp, oscillationFreq } = options;

    let worldCol = 0;
    let baseRow = 0;
    let alive = false;
    let active = false;
    let elapsed = 0;

    const model: UfoModel = {
        get worldCol() {
            return worldCol;
        },
        get worldRow() {
            return baseRow + Math.sin(elapsed * oscillationFreq * Math.PI * 2) * oscillationAmp;
        },
        get alive() {
            return alive;
        },
        get active() {
            return active;
        },

        activate(col: number, row: number): void {
            worldCol = col;
            baseRow = row;
            alive = true;
            active = true;
            elapsed = 0;
        },

        deactivate(): void {
            alive = false;
            active = false;
        },

        kill(): void {
            alive = false;
            active = false;
        },

        update(deltaMs: number): void {
            if (!active || !alive) return;

            const dt = deltaMs * 0.001;
            elapsed += dt;

            // Move leftward
            worldCol -= speed * dt;
        },
    };

    return model;
}
