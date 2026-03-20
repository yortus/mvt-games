import type { RotationDirection } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ShipModel {
    /** X position in pixels. */
    readonly x: number;
    /** Y position in pixels. */
    readonly y: number;
    /** Rotation angle in radians (0 = facing up). */
    readonly angle: number;
    /** Velocity X in pixels per second. */
    readonly vx: number;
    /** Velocity Y in pixels per second. */
    readonly vy: number;
    /** Whether the ship is alive. */
    readonly alive: boolean;
    /** Whether thrust is currently applied (for view flame). */
    readonly thrusting: boolean;
    setRotationDirection(dir: RotationDirection): void;
    setThrust(on: boolean): void;
    kill(): void;
    respawn(x: number, y: number): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ShipModelOptions {
    readonly startX: number;
    readonly startY: number;
    readonly rotationSpeed: number;
    readonly thrust: number;
    readonly drag: number;
    readonly maxSpeed: number;
    readonly arenaWidth: number;
    readonly arenaHeight: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createShipModel(options: ShipModelOptions): ShipModel {
    const { startX, startY, rotationSpeed, thrust, drag, maxSpeed, arenaWidth, arenaHeight } = options;

    let x = startX;
    let y = startY;
    let angle = 0;
    let vx = 0;
    let vy = 0;
    let alive = true;
    let thrusting = false;
    let rotationDirection: RotationDirection = 'none';

    const model: ShipModel = {
        get x() {
            return x;
        },
        get y() {
            return y;
        },
        get angle() {
            return angle;
        },
        get vx() {
            return vx;
        },
        get vy() {
            return vy;
        },
        get alive() {
            return alive;
        },
        get thrusting() {
            return thrusting;
        },

        setRotationDirection(dir: RotationDirection): void {
            rotationDirection = dir;
        },

        setThrust(on: boolean): void {
            thrusting = on;
        },

        kill(): void {
            alive = false;
            thrusting = false;
        },

        respawn(rx: number, ry: number): void {
            x = rx;
            y = ry;
            angle = 0;
            vx = 0;
            vy = 0;
            alive = true;
            thrusting = false;
            rotationDirection = 'none';
        },

        update(deltaMs: number): void {
            if (!alive) return;

            const dt = deltaMs * 0.001;

            // Rotation direction
            if (rotationDirection === 'left') {
                angle -= rotationSpeed * dt;
            } else if (rotationDirection === 'right') {
                angle += rotationSpeed * dt;
            }

            // Thrust
            if (thrusting) {
                vx += Math.sin(angle) * thrust * dt;
                vy -= Math.cos(angle) * thrust * dt;
            }

            // Drag (per-frame approximation)
            const dragFactor = Math.pow(drag, dt);
            vx *= dragFactor;
            vy *= dragFactor;

            // Clamp speed
            const speed = Math.sqrt(vx * vx + vy * vy);
            if (speed > maxSpeed) {
                const scale = maxSpeed / speed;
                vx *= scale;
                vy *= scale;
            }

            // Move
            x += vx * dt;
            y += vy * dt;

            // Wrap
            if (x < 0) x += arenaWidth;
            if (x > arenaWidth) x -= arenaWidth;
            if (y < 0) y += arenaHeight;
            if (y > arenaHeight) y -= arenaHeight;
        },
    };

    return model;
}
