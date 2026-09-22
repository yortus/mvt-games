// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface UfoModel {
    /** World column position in tile units. */
    readonly worldCol: number;
    /** World row position in tile units. */
    readonly worldRow: number;
    /** Advance UFO state - moves left with vertical sine oscillation. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UfoModelOptions {
    readonly worldCol: number;
    /** Row the UFO oscillates around. */
    readonly worldRow: number;
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

    let worldCol = options.worldCol;
    const baseRow = options.worldRow;
    let elapsed = 0;

    const model: UfoModel = {
        get worldCol() {
            return worldCol;
        },
        get worldRow() {
            return baseRow + Math.sin(elapsed * oscillationFreq * Math.PI * 2) * oscillationAmp;
        },

        update(deltaMs: number): void {
            const dt = deltaMs * 0.001;
            elapsed += dt;

            // Move leftward
            worldCol -= speed * dt;
        },
    };

    return model;
}
