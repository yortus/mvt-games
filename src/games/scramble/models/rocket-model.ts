import type { RocketPhase } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface RocketModel {
    /** World column position in tile units. */
    readonly worldCol: number;
    /** World row position in tile units. */
    readonly worldRow: number;
    /** Whether the rocket is alive (active and not destroyed). */
    readonly alive: boolean;
    /** Whether the rocket is currently in use (placed in the world). */
    readonly active: boolean;
    /** Current phase of the rocket. */
    readonly phase: RocketPhase;
    /** Place the rocket in the world at the given position. */
    activate(worldCol: number, worldRow: number): void;
    /** Remove the rocket from the world. */
    deactivate(): void;
    /** Destroy the rocket (killed by player). */
    kill(): void;
    /** Advance rocket state. Launches when ship is within detect range. */
    update(deltaMs: number, shipWorldCol: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RocketModelOptions {
    /** Horizontal tile distance at which the rocket detects the ship. */
    readonly detectRange: number;
    /** Upward launch speed in tiles per second. */
    readonly launchSpeed: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRocketModel(options: RocketModelOptions): RocketModel {
    const { detectRange, launchSpeed } = options;

    let worldCol = 0;
    let worldRow = 0;
    let alive = false;
    let active = false;
    let phase: RocketPhase = 'idle';
    let vRow = 0;

    const model: RocketModel = {
        get worldCol() {
            return worldCol;
        },
        get worldRow() {
            return worldRow;
        },
        get alive() {
            return alive;
        },
        get active() {
            return active;
        },
        get phase() {
            return phase;
        },

        activate(col: number, row: number): void {
            worldCol = col;
            worldRow = row;
            alive = true;
            active = true;
            phase = 'idle';
            vRow = 0;
        },

        deactivate(): void {
            alive = false;
            active = false;
            phase = 'idle';
        },

        kill(): void {
            alive = false;
            active = false;
        },

        update(deltaMs: number, shipWorldCol: number): void {
            if (!active || !alive) return;

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
                // Deactivate when far off-screen above
                if (worldRow < -3) {
                    model.deactivate();
                }
            }
        },
    };

    return model;
}
