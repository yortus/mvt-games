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
    /** Activate the bullet at a position with a given velocity. */
    fire(x: number, y: number, vx: number, vy: number): void;
    /** Deactivate the bullet immediately. */
    deactivate(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BulletModelOptions {
    /** Bullet lifetime in ms before auto-deactivation. */
    readonly lifetimeMs: number;
    readonly arenaWidth: number;
    readonly arenaHeight: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBulletModel(options: BulletModelOptions): BulletModel {
    const { lifetimeMs, arenaWidth, arenaHeight } = options;

    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;
    let active = false;
    let timer = 0;

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

        fire(fx: number, fy: number, fvx: number, fvy: number): void {
            x = fx;
            y = fy;
            vx = fvx;
            vy = fvy;
            active = true;
            timer = 0;
        },

        deactivate(): void {
            active = false;
        },

        update(deltaMs: number): void {
            if (!active) return;

            const dt = deltaMs * 0.001;
            x += vx * dt;
            y += vy * dt;

            // Wrap
            if (x < 0) x += arenaWidth;
            if (x > arenaWidth) x -= arenaWidth;
            if (y < 0) y += arenaHeight;
            if (y > arenaHeight) y -= arenaHeight;

            // Lifetime
            timer += deltaMs;
            if (timer >= lifetimeMs) {
                active = false;
            }
        },
    };

    return model;
}
