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
    /** How far the ship can go along the screen, in columns from its left edge, and up and down it, in rows. */
    readonly minScreenCol: number;
    readonly maxScreenCol: number;
    readonly minRow: number;
    readonly maxRow: number;
    setXDirection: (dir: XDirection) => void;
    setYDirection: (dir: YDirection) => void;
    /**
     * Sets where the ship flies to, at its own speed, instead of the ways it
     * is pushed: a column from the screen's left edge, and a row. Undefined
     * for none.
     */
    setTarget: (screenCol: number | undefined, row: number | undefined) => void;
    kill: () => void;
    respawn: (worldCol: number, worldRow: number) => void;
    /**
     * Advance ship state. The ship moves at scroll speed plus player input,
     * clamped so its screen-relative column stays within bounds.
     */
    update: (deltaMs: number, scrollCol: number) => void;
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
    let targetScreenCol: number | undefined;
    let targetRow: number | undefined;
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
        minScreenCol,
        maxScreenCol,
        minRow,
        maxRow,

        setXDirection(dir: XDirection): void {
            xDir = dir;
        },

        setYDirection(dir: YDirection): void {
            yDir = dir;
        },

        setTarget(screenCol: number | undefined, row: number | undefined): void {
            targetScreenCol = screenCol;
            targetRow = row;
        },

        kill(): void {
            alive = false;
        },

        respawn(col: number, row: number): void {
            worldCol = col;
            worldRow = row;
            xDir = 'none';
            yDir = 'none';
            targetScreenCol = undefined;
            targetRow = undefined;
            alive = true;
        },

        update(deltaMs: number, scrollCol: number): void {
            if (!alive) return;

            const dt = deltaMs * 0.001;

            // Advance with forced scroll
            worldCol += scrollSpeed * dt;

            // Player horizontal input: toward the target, or the way pushed
            const step = speed * dt;
            if (targetScreenCol !== undefined) worldCol += clampStep(targetScreenCol - (worldCol - scrollCol), step);
            else if (xDir === 'left') worldCol -= step;
            else if (xDir === 'right') worldCol += step;

            // Player vertical input
            if (targetRow !== undefined) worldRow += clampStep(targetRow - worldRow, step);
            else if (yDir === 'up') worldRow -= step;
            else if (yDir === 'down') worldRow += step;

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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** As much of `distance` as one step of at most `step` covers, either way. */
function clampStep(distance: number, step: number): number {
    return Math.max(-step, Math.min(step, distance));
}
