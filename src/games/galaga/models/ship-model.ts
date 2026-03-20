import type { Direction } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ShipModel {
    /** Visual x position in pixels. */
    readonly x: number;
    /** Visual y position in pixels. */
    readonly y: number;
    /** Whether the ship is alive. */
    readonly alive: boolean;
    /** Current movement direction. */
    readonly direction: Direction;
    setDirection(dir: Direction): void;
    kill(): void;
    respawn(x: number): void;
    update(deltaMs: number): void;
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
    let alive = true;

    const model: ShipModel = {
        get x() {
            return x;
        },
        get y() {
            return y;
        },
        get alive() {
            return alive;
        },
        get direction() {
            return direction;
        },

        setDirection(dir: Direction): void {
            direction = dir;
        },

        kill(): void {
            alive = false;
        },

        respawn(newX: number): void {
            x = newX;
            direction = 'none';
            alive = true;
        },

        update(deltaMs: number): void {
            if (!alive) return;

            const deltaSec = deltaMs * 0.001;
            if (direction === 'left') {
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
