import type { Direction } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ShipModel {
    /** Visual x position in world-units. */
    readonly x: number;
    /** Visual y position in world-units. */
    readonly y: number;
    /** How far left and right the ship can go, in world-units. */
    readonly minX: number;
    readonly maxX: number;
    /** Whether the ship is alive. */
    readonly isAlive: boolean;
    /** Current movement direction. */
    readonly direction: Direction;
    setDirection: (dir: Direction) => void;
    /** Sets where the ship flies to, at its own speed, instead of the way it is moving, or undefined for none. */
    setTargetX: (targetX: number | undefined) => void;
    kill: () => void;
    respawn: (x: number) => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ShipModelOptions {
    readonly startX: number;
    readonly startY: number;
    readonly speed: number;
    readonly minX: number;
    readonly maxX: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createShipModel(options: ShipModelOptions): ShipModel {
    const { startX, startY, speed, minX, maxX } = options;

    let x = startX;
    const y = startY;
    let direction: Direction = 'none';
    let targetX: number | undefined;
    let alive = true;

    const model: ShipModel = {
        get x() {
            return x;
        },
        get y() {
            return y;
        },
        minX,
        maxX,
        get isAlive() {
            return alive;
        },
        get direction() {
            return direction;
        },

        setDirection(dir: Direction): void {
            direction = dir;
        },

        setTargetX(value: number | undefined): void {
            targetX = value;
        },

        kill(): void {
            alive = false;
        },

        respawn(newX: number): void {
            x = newX;
            direction = 'none';
            targetX = undefined;
            alive = true;
        },

        update(deltaMs: number): void {
            if (!alive) return;

            const deltaSec = deltaMs * 0.001;
            if (targetX !== undefined) {
                // As far toward the target as its speed allows, and no further
                const step = speed * deltaSec;
                x += Math.max(-step, Math.min(step, targetX - x));
            }
            else if (direction === 'left') {
                x -= speed * deltaSec;
            }
            else if (direction === 'right') {
                x += speed * deltaSec;
            }

            if (x < minX) x = minX;
            if (x > maxX) x = maxX;
        },
    };

    return model;
}
