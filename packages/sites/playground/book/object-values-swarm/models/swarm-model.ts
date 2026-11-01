import type { Random } from './seeded-random';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How fast an enemy drifts for each point of speed, in world units per ms. */
const PACE_PER_SPEED = 0.004;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What an enemy is made of. Each stat is a whole number from 1 to `MAX_STAT`. */
export interface EnemyStats {
    readonly health: number;
    readonly armour: number;
    readonly attack: number;
    readonly speed: number;
}

/** One enemy in the swarm. Positions are in world units, with the arena's top left corner at 0, 0. */
export interface Enemy {
    readonly x: number;
    readonly y: number;
    readonly stats: EnemyStats;
}

/** A swarm of enemies, each drifting in a straight line, and bouncing off the arena's walls. */
export interface SwarmModel {
    readonly enemies: readonly Enemy[];
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SwarmModelOptions {
    /** How many enemies there are. */
    readonly count: number;
    /** The arena's size, in world units. */
    readonly width: number;
    readonly height: number;
    /** Where the enemies start, how they move, and their stats come from this. */
    readonly random: Random;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a swarm spread across the arena, each enemy with stats of its own. */
export function createSwarmModel({ count, width, height, random }: SwarmModelOptions): SwarmModel {
    const enemies: MutableEnemy[] = [];
    for (let i = 0; i < count; i++) {
        const stats: EnemyStats = {
            health: rollStat(random),
            armour: rollStat(random),
            attack: rollStat(random),
            speed: rollStat(random),
        };
        const angle = random() * Math.PI * 2;
        const pace = stats.speed * PACE_PER_SPEED;
        enemies.push({
            x: random() * width,
            y: random() * height,
            vx: Math.cos(angle) * pace,
            vy: Math.sin(angle) * pace,
            stats,
        });
    }

    const model: SwarmModel = {
        enemies,

        update(deltaMs) {
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                enemy.x += enemy.vx * deltaMs;
                enemy.y += enemy.vy * deltaMs;
                if (enemy.x < 0 || enemy.x > width) {
                    enemy.vx = -enemy.vx;
                    enemy.x = Math.min(width, Math.max(0, enemy.x));
                }
                if (enemy.y < 0 || enemy.y > height) {
                    enemy.vy = -enemy.vy;
                    enemy.y = Math.min(height, Math.max(0, enemy.y));
                }
            }
        },
    };

    return model;
}

/** The highest any one stat can be. */
export const MAX_STAT = 10;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface MutableEnemy extends Enemy {
    x: number;
    y: number;
    /** Velocity, in world units per ms. */
    vx: number;
    vy: number;
}

function rollStat(random: Random): number {
    return 1 + Math.floor(random() * MAX_STAT);
}
