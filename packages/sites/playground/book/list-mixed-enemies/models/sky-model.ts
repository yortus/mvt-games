// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How often a new enemy arrives, in ms. */
const SPAWN_MS = 400;
/** How many enemies are in the sky at the start. */
const START_ENEMIES = 10;
/** How fast each kind drifts, in world units per ms. */
const SPEED: Readonly<Record<EnemyKind, number>> = { asteroid: 0.08, saucer: 0.14 };

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What an enemy is. */
export type EnemyKind = 'asteroid' | 'saucer';

/** An enemy crossing the sky. Positions are in world units, from the top left corner. */
export interface EnemyModel {
    readonly kind: EnemyKind;
    /** Picks this enemy's shape, for kinds that have one of their own, such as an asteroid's. */
    readonly seed: number;
    readonly x: number;
    readonly y: number;
}

/**
 * A sky that enemies of two kinds drift across, from right to left. New
 * enemies arrive at the right edge. An enemy that leaves at the left edge
 * is removed by moving the last enemy into its place, so the array never
 * has a gap.
 */
export interface SkyModel {
    readonly enemies: readonly EnemyModel[];
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SkyModelOptions {
    /** The width of the sky, in world units. */
    readonly width: number;
    /** The height of the sky, in world units. */
    readonly height: number;
    /** Where the random choices start, so the same seed gives the same sky every time. */
    readonly seed: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a sky with a few enemies already in it. */
export function createSkyModel({ width, height, seed }: SkyModelOptions): SkyModel {
    const enemies: MutableEnemy[] = [];
    let randomState = seed;
    let sinceSpawnMs = 0;

    for (let i = 0; i < START_ENEMIES; i++) {
        spawnEnemy(random() * width);
    }

    const model: SkyModel = {
        enemies,

        update(deltaMs) {
            for (let i = enemies.length - 1; i >= 0; i--) {
                const enemy = enemies[i];
                enemy.x -= SPEED[enemy.kind] * deltaMs;
                if (enemy.x < -MARGIN) {
                    // Move the last enemy into this one's place, then drop the last
                    enemies[i] = enemies[enemies.length - 1];
                    enemies.pop();
                }
            }

            sinceSpawnMs += deltaMs;
            while (sinceSpawnMs >= SPAWN_MS) {
                sinceSpawnMs -= SPAWN_MS;
                spawnEnemy(width + MARGIN);
            }
        },
    };

    return model;

    function spawnEnemy(x: number): void {
        enemies.push({
            kind: random() < 0.5 ? 'asteroid' : 'saucer',
            seed: Math.floor(random() * 1_000_000),
            x,
            y: MARGIN + random() * (height - MARGIN * 2),
        });
    }

    /** A number from 0 up to 1, the next in a fixed sequence that starts at the seed. */
    function random(): number {
        randomState = (randomState + 0x6d2b79f5) | 0;
        let t = randomState;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface MutableEnemy {
    kind: EnemyKind;
    seed: number;
    x: number;
    y: number;
}

/** How far outside the sky an enemy starts and is removed, and how far from the top and bottom it stays. */
const MARGIN = 30;
