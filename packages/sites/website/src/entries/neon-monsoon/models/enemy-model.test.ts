import { describe, expect, it } from 'vitest';
import type { BulletKind, PathDef, PatternDef } from '../data';
import { createBulletField } from './bullet-field';
import { createEnemyModel } from './enemy-model';
import { BULLET_HIT_RADII, ENEMY_HEALTH } from './model-constants';

const STEP = 1000 / 60;

function setUp(path: PathDef, patterns: readonly PatternDef[] = [], deathPatterns?: readonly PatternDef[]) {
    const bullets = createBulletField<BulletKind>({ capacity: 256, hitRadii: BULLET_HIT_RADII, width: 240, height: 320, margin: 16 });
    const target = { x: 120, y: 300 };
    const ground = { scrollSpeed: 30 };
    const enemy = createEnemyModel({ kind: 'kite', x: 120, y: -16, path, patterns, deathPatterns, bullets, target, ground });
    return { bullets, target, ground, enemy };
}

function run(update: (deltaMs: number) => void, ms: number): void {
    const steps = Math.round(ms / STEP);
    for (let i = 0; i < steps; i++) update(STEP);
}

const RING: PatternDef = { kind: 'ring', count: 4, bullet: 'pellet-red', motion: { speed: 0 }, intervalMs: 500 };

describe('EnemyModel', () => {
    it('flies a straight path, and has left once it is off the arena', () => {
        const { enemy } = setUp({ kind: 'straight', speed: 100 });
        run(enemy.update, 1000);
        expect(enemy.y).toBeCloseTo(84, 0);
        expect(enemy.hasLeft).toBe(false);
        run(enemy.update, 3000);
        expect(enemy.hasLeft).toBe(true);
    });

    it('holds at stopY, then dives at where the ship was', () => {
        const { target, enemy } = setUp({ kind: 'dive', speed: 100, stopY: 60, holdMs: 500, diveSpeed: 200 });
        run(enemy.update, 1000);
        expect(enemy.y).toBe(60);
        target.x = 220;
        run(enemy.update, 500);
        expect(enemy.x).toBeGreaterThan(120);
        expect(enemy.y).toBeGreaterThan(60);
    });

    it('moves with the ground, and stops when the scroll stops', () => {
        const { ground, enemy } = setUp({ kind: 'ground' });
        run(enemy.update, 1000);
        expect(enemy.y).toBeCloseTo(14, 0);
        ground.scrollSpeed = 0;
        run(enemy.update, 1000);
        expect(enemy.y).toBeCloseTo(14, 0);
        expect(enemy.isGrounded).toBe(true);
    });

    it('fires only while on screen', () => {
        const { bullets, enemy } = setUp({ kind: 'straight', speed: 100 }, [RING]);
        enemy.update(STEP);
        expect(bullets.count).toBe(0);
        run(enemy.update, 300);
        expect(bullets.count).toBeGreaterThan(0);
    });

    it('dies when its health runs out, and fires its death volleys once', () => {
        const { bullets, enemy } = setUp({ kind: 'straight', speed: 0 }, [], [RING]);
        enemy.takeDamage(ENEMY_HEALTH.kite - 1);
        expect(enemy.isAlive).toBe(true);
        enemy.takeDamage(5);
        expect(enemy.isAlive).toBe(false);
        expect(enemy.health).toBe(0);
        expect(bullets.count).toBe(4);
        enemy.takeDamage(5);
        expect(bullets.count).toBe(4);
    });
});
