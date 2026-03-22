import type { XDirection, YDirection } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ShipModel {
    /** World column position in tile units. */
    readonly worldCol: number;
    /** World row position in tile units. */
    readonly worldRow: number;
    /** Whether the ship is alive. */
    readonly isAlive: boolean;
    setXDirection(dir: XDirection): void;
    setYDirection(dir: YDirection): void;
    kill(): void;
    respawn(worldCol: number, worldRow: number): void;
    /**
     * Advance ship state. The ship moves at scroll speed plus player input,
     * clamped so its screen-relative column stays within bounds.
     */
    update(deltaMs: number, scrollCol: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ShipModelOptions {
    readonly startWorldCol: number;
    readonly startWorldRow: number;
    /** Player-controlled movement speed in tiles per second. */
    readonly speed: number;
    /** Forced horizontal scroll speed in tiles per second. */
    readonly scrollSpeed: number;
    /** Minimum screen-relative column (left boundary). */
    readonly minScreenCol: number;
    /** Maximum screen-relative column (right boundary). */
    readonly maxScreenCol: number;
    /** Minimum row (top boundary). */
    readonly minRow: number;
    /** Maximum row (bottom boundary). */
    readonly maxRow: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createShipModel(options: ShipModelOptions): ShipModel {
    const { speed, scrollSpeed, minScreenCol, maxScreenCol, minRow, maxRow } = options;

    let worldCol = options.startWorldCol;
    let worldRow = options.startWorldRow;
    let xDir: XDirection = 'none';
    let yDir: YDirection = 'none';
    let alive = true;

    const model: ShipModel = {
        get worldCol() {
            return worldCol;
        },
        get worldRow() {
            return worldRow;
        },
        get isAlive() {
            return alive;
        },

        setXDirection(dir: XDirection): void {
            xDir = dir;
        },

        setYDirection(dir: YDirection): void {
            yDir = dir;
        },

        kill(): void {
            alive = false;
        },

        respawn(col: number, row: number): void {
            worldCol = col;
            worldRow = row;
            xDir = 'none';
            yDir = 'none';
            alive = true;
        },

        update(deltaMs: number, scrollCol: number): void {
            if (!alive) return;

            const dt = deltaMs * 0.001;

            // Advance with forced scroll
            worldCol += scrollSpeed * dt;

            // Player horizontal input
            if (xDir === 'left') worldCol -= speed * dt;
            else if (xDir === 'right') worldCol += speed * dt;

            // Player vertical input
            if (yDir === 'up') worldRow -= speed * dt;
            else if (yDir === 'down') worldRow += speed * dt;

            // Clamp screen-relative column
            const screenCol = worldCol - scrollCol;
            if (screenCol < minScreenCol) worldCol = scrollCol + minScreenCol;
            else if (screenCol > maxScreenCol) worldCol = scrollCol + maxScreenCol;

            // Clamp vertical
            if (worldRow < minRow) worldRow = minRow;
            else if (worldRow > maxRow) worldRow = maxRow;
        },
    };

    return model;
}
