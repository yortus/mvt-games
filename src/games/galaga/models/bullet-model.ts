// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface BulletModel {
    /** X position in pixels. */
    readonly x: number;
    /** Y position in pixels. */
    readonly y: number;
    /** Whether this bullet is currently in flight. */
    readonly isActive: boolean;
    /** Activate the bullet at a position with a given vertical speed (negative = up). */
    fire(x: number, y: number, speed: number): void;
    /** Deactivate the bullet immediately. */
    deactivate(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BulletModelOptions {
    /** Bullets above this Y are deactivated. */
    readonly minY: number;
    /** Bullets below this Y are deactivated. */
    readonly maxY: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBulletModel(options: BulletModelOptions): BulletModel {
    const { minY, maxY } = options;

    let x = 0;
    let y = 0;
    let speed = 0;
    let active = false;

    const model: BulletModel = {
        get x() {
            return x;
        },
        get y() {
            return y;
        },
        get isActive() {
            return active;
        },

        fire(fx: number, fy: number, fSpeed: number): void {
            x = fx;
            y = fy;
            speed = fSpeed;
            active = true;
        },

        deactivate(): void {
            active = false;
        },

        update(deltaMs: number): void {
            if (!active) return;

            y += speed * deltaMs * 0.001;

            if (y < minY || y > maxY) {
                active = false;
            }
        },
    };

    return model;
}
