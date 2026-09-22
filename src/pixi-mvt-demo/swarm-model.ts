// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * One swarm member. Coordinates are domain-level (unit square), never pixels -
 * the view decides what a unit is worth on screen.
 */
export interface SwarmEntity {
    readonly id: number;
    readonly x: number;
    readonly y: number;
    readonly hue: number;
    readonly ageMs: number;
    readonly lifespanMs: number;
}

export interface SwarmModel {
    readonly entities: readonly SwarmEntity[];
    /** Entities created per second. Drives how hard the scene graph churns. */
    spawnRate: number;
    readonly spawnedTotal: number;
    readonly despawnedTotal: number;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SwarmModelOptions {
    spawnRate?: number;
    initialCount?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSwarmModel(options: SwarmModelOptions = {}): SwarmModel {
    const entities: MutableEntity[] = [];
    let spawnRate = options.spawnRate ?? 30;
    let spawnAccumulator = 0;
    let nextId = 1;
    let spawnedTotal = 0;
    let despawnedTotal = 0;
    // Deterministic, so the demo behaves the same on every reload and does not
    // reach for a wall clock to seed itself.
    let randomState = 0x5eed1234;

    const initial = options.initialCount ?? 400;
    for (let i = 0; i < initial; i++) {
        entities.push(createEntity());
    }

    return {
        entities,
        get spawnRate(): number {
            return spawnRate;
        },
        set spawnRate(value: number) {
            spawnRate = value < 0 ? 0 : value;
        },
        get spawnedTotal(): number {
            return spawnedTotal;
        },
        get despawnedTotal(): number {
            return despawnedTotal;
        },
        update,
    };

    function update(deltaMs: number): void {
        const deltaSeconds = deltaMs / 1000;

        // Age everything, and compact the dead out in one backwards pass so no
        // intermediate array is allocated.
        for (let i = entities.length - 1; i >= 0; i--) {
            const entity = entities[i];
            entity.ageMs += deltaMs;
            entity.angle += entity.angularSpeed * deltaSeconds;
            entity.radius += entity.radialSpeed * deltaSeconds;
            entity.x = 0.5 + Math.cos(entity.angle) * entity.radius;
            entity.y = 0.5 + Math.sin(entity.angle) * entity.radius * ASPECT_SQUASH;
            if (entity.ageMs >= entity.lifespanMs) {
                entities[i] = entities[entities.length - 1];
                entities.length--;
                despawnedTotal++;
            }
        }

        spawnAccumulator += spawnRate * deltaSeconds;
        while (spawnAccumulator >= 1) {
            spawnAccumulator -= 1;
            entities.push(createEntity());
        }
    }

    function createEntity(): MutableEntity {
        const angle = random() * Math.PI * 2;
        const radius = 0.04 + random() * 0.06;
        spawnedTotal++;
        return {
            id: nextId++,
            x: 0.5 + Math.cos(angle) * radius,
            y: 0.5 + Math.sin(angle) * radius * ASPECT_SQUASH,
            hue: random(),
            ageMs: 0,
            lifespanMs: 1200 + random() * 2600,
            angle,
            radius,
            angularSpeed: 0.5 + random() * 1.4,
            radialSpeed: 0.03 + random() * 0.08,
        };
    }

    function random(): number {
        randomState = (randomState * 1664525 + 1013904223) >>> 0;
        return randomState / 0x100000000;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Keeps the orbits looking circular on a wide viewport. */
const ASPECT_SQUASH = 0.62;

interface MutableEntity {
    id: number;
    x: number;
    y: number;
    hue: number;
    ageMs: number;
    lifespanMs: number;
    angle: number;
    radius: number;
    angularSpeed: number;
    radialSpeed: number;
}
