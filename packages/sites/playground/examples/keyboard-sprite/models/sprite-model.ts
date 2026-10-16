// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A sprite that moves at a steady speed in the direction it is steered,
 * and faces the way it last moved. It stays inside the play area. Positions
 * are in world units, with the play area's top left corner at 0, 0.
 */
export interface SpriteModel {
    readonly x: number;
    readonly y: number;
    /** The way the sprite faces, in radians clockwise from the right. */
    readonly angle: number;
    readonly isMoving: boolean;
    /**
     * Steers the sprite. `dx` is -1 for left, 1 for right and 0 for neither,
     * and `dy` is -1 for up, 1 for down and 0 for neither. Steering both ways
     * at once moves diagonally, no faster than straight.
     */
    readonly steer: (dx: number, dy: number) => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SpriteModelOptions {
    /** The width of the play area, in world units. */
    readonly width: number;
    /** The height of the play area, in world units. */
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a sprite at the centre of the play area, facing right and not moving. */
export function createSpriteModel({ width, height }: SpriteModelOptions): SpriteModel {
    let x = width / 2;
    let y = height / 2;
    let angle = 0;
    let isMoving = false;
    let steerX = 0;
    let steerY = 0;

    const model: SpriteModel = {
        get x() { return x; },
        get y() { return y; },
        get angle() { return angle; },
        get isMoving() { return isMoving; },

        steer(dx, dy) {
            steerX = Math.sign(dx);
            steerY = Math.sign(dy);
        },

        update(deltaMs) {
            isMoving = steerX !== 0 || steerY !== 0;
            if (!isMoving) return;

            // Scaled to a length of 1, so a diagonal is no faster than straight
            const length = Math.sqrt(steerX * steerX + steerY * steerY);
            const dx = steerX / length;
            const dy = steerY / length;
            angle = Math.atan2(dy, dx);

            const distance = SPEED * deltaMs;
            x = clamp(x + dx * distance, MARGIN, width - MARGIN);
            y = clamp(y + dy * distance, MARGIN, height - MARGIN);
        },
    };

    return model;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** In world units per ms. */
const SPEED = 0.15;
/** How close the sprite's centre comes to the edges of the play area. */
const MARGIN = 10;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
