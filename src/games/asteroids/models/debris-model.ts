// ---------------------------------------------------------------------------
// Particle
// ---------------------------------------------------------------------------

export interface DebrisParticle {
    readonly x: number;
    readonly y: number;
    readonly angle: number;
    /** Half-length of the line segment in pixels. */
    readonly length: number;
    readonly active: boolean;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface DebrisModel {
    readonly particles: readonly DebrisParticle[];
    /** Whether any particles are currently active. */
    readonly active: boolean;
    /** Spawn debris at the given position, spreading outward. */
    spawn(x: number, y: number, shipAngle: number): void;
    /** Spawn debris that converges inward to the given position. */
    reverseSpawn(targetX: number, targetY: number, shipAngle: number, durationMs?: number): void;
    /** Deactivate all particles. */
    clear(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DebrisModelOptions {
    /** Number of debris particles to allocate. */
    readonly count?: number;
    /** Minimum outward speed in pixels per second. */
    readonly minSpeed?: number;
    /** Maximum outward speed in pixels per second. */
    readonly maxSpeed?: number;
    /** Lifetime of each particle in milliseconds. */
    readonly lifetimeMs?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

interface MutableParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    rotationSpeed: number;
    length: number;
    active: boolean;
    timer: number;
}

export function createDebrisModel(options: DebrisModelOptions = {}): DebrisModel {
    const { count = 8, minSpeed = 30, maxSpeed = 120, lifetimeMs = 1500 } = options;

    // Pre-allocate particle pool
    const pool: MutableParticle[] = [];
    for (let i = 0; i < count; i++) {
        pool.push({
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            angle: 0,
            rotationSpeed: 0,
            length: 4,
            active: false,
            timer: 0,
        });
    }

    let anyActive = false;
    let activeLifetimeMs = lifetimeMs;

    const model: DebrisModel = {
        get particles() {
            return pool;
        },
        get active() {
            return anyActive;
        },

        spawn(x: number, y: number, shipAngle: number): void {
            activeLifetimeMs = lifetimeMs;
            // Ship line segments roughly model the classical ship shape.
            // Each particle gets a random outward direction plus a portion
            // of the original ship angle to keep the explosion coherent.
            const angleStep = (Math.PI * 2) / count;
            for (let i = 0; i < count; i++) {
                const p = pool[i];
                const dir = shipAngle + angleStep * i + (Math.random() - 0.5) * 0.6;
                const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
                p.x = x;
                p.y = y;
                p.vx = Math.sin(dir) * speed;
                p.vy = -Math.cos(dir) * speed;
                p.angle = dir + Math.random() * Math.PI;
                p.rotationSpeed = (Math.random() - 0.5) * 8;
                p.length = 3 + Math.random() * 5;
                p.active = true;
                p.timer = 0;
            }
            anyActive = true;
        },

        reverseSpawn(targetX: number, targetY: number, shipAngle: number, durationMs?: number): void {
            // Particles start spread out and converge to the target position.
            // Compute where each particle would be at the end of a normal
            // explosion, then give it velocity pointing back inward.
            activeLifetimeMs = durationMs ?? lifetimeMs;
            const angleStep = (Math.PI * 2) / count;
            const tSec = activeLifetimeMs * 0.001;
            for (let i = 0; i < count; i++) {
                const p = pool[i];
                const dir = shipAngle + angleStep * i + (Math.random() - 0.5) * 0.6;
                const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
                // Start position: offset from target by travel distance
                const offsetX = Math.sin(dir) * speed * tSec;
                const offsetY = -Math.cos(dir) * speed * tSec;
                p.x = targetX + offsetX;
                p.y = targetY + offsetY;
                // Velocity points inward toward target
                p.vx = -Math.sin(dir) * speed;
                p.vy = Math.cos(dir) * speed;
                p.angle = dir + Math.random() * Math.PI;
                p.rotationSpeed = (Math.random() - 0.5) * 8;
                p.length = 3 + Math.random() * 5;
                p.active = true;
                p.timer = 0;
            }
            anyActive = true;
        },

        clear(): void {
            for (let i = 0; i < count; i++) {
                pool[i].active = false;
            }
            anyActive = false;
        },

        update(deltaMs: number): void {
            if (!anyActive) return;

            const dt = deltaMs * 0.001;
            let stillActive = false;

            for (let i = 0; i < count; i++) {
                const p = pool[i];
                if (!p.active) continue;

                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.angle += p.rotationSpeed * dt;
                p.timer += deltaMs;

                if (p.timer >= activeLifetimeMs) {
                    p.active = false;
                } else {
                    stillActive = true;
                }
            }

            anyActive = stillActive;
        },
    };

    return model;
}
