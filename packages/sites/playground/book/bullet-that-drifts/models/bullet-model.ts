// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How fast the bullet flies, in world units per ms. */
export const BULLET_SPEED = 0.2;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A bullet that flies up from a gun, at a steady speed. When it passes the
 * top of its range, the gun fires it again. Its height is in world units,
 * with the top of the play area at 0.
 */
export interface BulletModel {
    readonly y: number;
    /** Where the gun is, which the bullet starts from. */
    readonly gunY: number;
    /** How far up the bullet flies before the gun fires it again. */
    readonly topY: number;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BulletModelOptions {
    readonly gunY: number;
    readonly topY: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a bullet that has just left the gun. */
export function createBulletModel({ gunY, topY }: BulletModelOptions): BulletModel {
    let y = gunY;

    const model: BulletModel = {
        get y() { return y; },
        gunY,
        topY,

        update(deltaMs) {
            y -= BULLET_SPEED * deltaMs;
            if (y < topY) y += gunY - topY;
        },
    };

    return model;
}
