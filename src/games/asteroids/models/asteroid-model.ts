import type { AsteroidSize } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface AsteroidModel {
    /** X position in pixels. */
    readonly x: number;
    /** Y position in pixels. */
    readonly y: number;
    /** Visual rotation angle in radians. */
    readonly angle: number;
    readonly size: AsteroidSize;
    readonly radius: number;
    readonly isAlive: boolean;
    /** Shape seed for deterministic outline in the view. */
    readonly shapeSeed: number;
    kill(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface AsteroidModelOptions {
    readonly startX: number;
    readonly startY: number;
    readonly vx: number;
    readonly vy: number;
    readonly size: AsteroidSize;
    readonly radius: number;
    readonly arenaWidth: number;
    readonly arenaHeight: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAsteroidModel(options: AsteroidModelOptions): AsteroidModel {
    const { startX, startY, vx, vy, size, radius, arenaWidth, arenaHeight } = options;

    let x = startX;
    let y = startY;
    let angle = 0;
    let alive = true;
    const shapeSeed = nextSeed++;
    // Deterministic rotation speed from seed
    const rotationSpeed = ((shapeSeed % 7) - 3) * 0.4;

    const model: AsteroidModel = {
        get x() {
            return x;
        },
        get y() {
            return y;
        },
        get angle() {
            return angle;
        },
        get size() {
            return size;
        },
        get radius() {
            return radius;
        },
        get isAlive() {
            return alive;
        },
        get shapeSeed() {
            return shapeSeed;
        },

        kill(): void {
            alive = false;
        },

        update(deltaMs: number): void {
            if (!alive) return;

            const dt = deltaMs * 0.001;
            x += vx * dt;
            y += vy * dt;
            angle += rotationSpeed * dt;

            // Wrap
            if (x < -radius) x += arenaWidth + radius * 2;
            if (x > arenaWidth + radius) x -= arenaWidth + radius * 2;
            if (y < -radius) y += arenaHeight + radius * 2;
            if (y > arenaHeight + radius) y -= arenaHeight + radius * 2;
        },
    };

    return model;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

let nextSeed = 1;
