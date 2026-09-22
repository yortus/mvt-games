import type { RocketPhase } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface RocketModel {
    /** World column position in tile units. */
    readonly worldCol: number;
    /** World row position in tile units. */
    readonly worldRow: number;
    /** Current phase of the rocket. */
    readonly phase: RocketPhase;
    /** Advance rocket state. Launches when ship is within detect range. */
    update(deltaMs: number, shipWorldCol: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RocketModelOptions {
    readonly worldCol: number;
    readonly worldRow: number;
    /** Horizontal tile distance at which the rocket detects the ship. */
    readonly detectRange: number;
    /** Upward launch speed in tiles per second. */
    readonly launchSpeed: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRocketModel(options: RocketModelOptions): RocketModel {
    const { worldCol, detectRange, launchSpeed } = options;

    let worldRow = options.worldRow;
    let phase: RocketPhase = 'idle';
    let vRow = 0;

    const model: RocketModel = {
        get worldCol() {
            return worldCol;
        },
        get worldRow() {
            return worldRow;
        },
        get phase() {
            return phase;
        },

        update(deltaMs: number, shipWorldCol: number): void {
            const dt = deltaMs * 0.001;

            if (phase === 'idle') {
                // Detect ship within horizontal range
                const dist = shipWorldCol - worldCol;
                if (dist > -detectRange && dist < detectRange) {
                    phase = 'launching';
                    vRow = -launchSpeed;
                }
            }

            if (phase === 'launching') {
                worldRow += vRow * dt;
                // Once cleared the top rows, switch to flying
                if (worldRow < 0) {
                    phase = 'flying';
                }
            }

            if (phase === 'flying') {
                worldRow += vRow * dt;
            }
        },
    };

    return model;
}
