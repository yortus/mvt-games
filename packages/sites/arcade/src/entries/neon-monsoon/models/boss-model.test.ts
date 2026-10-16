import { describe, expect, it } from 'vitest';
import type { BossAttackDef, BulletKind } from '../data';
import { createBossModel } from './boss-model';
import { createBulletField } from './bullet-field';
import { BOSS_BREAK_MS, BOSS_ENTER_MS, BOSS_EXPLODE_MS, BULLET_HIT_RADII } from './model-constants';

const STEP = 1000 / 60;

const ATTACKS: readonly BossAttackDef[] = [
    {
        kind: 'squall', health: 100, timeLimitMs: 5000, swayX: 0, swayPeriodMs: 1000,
        patterns: [{ kind: 'ring', count: 6, bullet: 'orb-red', motion: { speed: 0 }, intervalMs: 1000 }],
    },
    { kind: 'cyclone', health: 100, timeLimitMs: 5000, swayX: 0, swayPeriodMs: 1000, patterns: [] },
];

function setUp() {
    const bullets = createBulletField<BulletKind>({ capacity: 256, hitRadii: BULLET_HIT_RADII, width: 240, height: 320, margin: 16 });
    const boss = createBossModel({ attacks: ATTACKS, bullets, target: { x: 120, y: 300 } });
    return { bullets, boss };
}

function run(update: (deltaMs: number) => void, ms: number): void {
    const steps = Math.round(ms / STEP);
    for (let i = 0; i < steps; i++) update(STEP);
}

describe('BossModel', () => {
    it('is absent until it arrives, then enters, unhurt, before attacking', () => {
        const { boss } = setUp();
        expect(boss.phase).toBe('absent');
        boss.arrive({ speedScale: 1, densityScale: 1 });
        expect(boss.phase).toBe('entering');
        boss.takeDamage(50);
        run(boss.update, BOSS_ENTER_MS + STEP);
        expect(boss.phase).toBe('attacking');
        expect(boss.healthFraction).toBe(1);
    });

    it('fires its attack\'s patterns', () => {
        const { bullets, boss } = setUp();
        boss.arrive({ speedScale: 1, densityScale: 1 });
        run(boss.update, BOSS_ENTER_MS + 100);
        expect(bullets.count).toBe(6);
    });

    it('breaks an attack when its health runs out, then starts the next', () => {
        const { boss } = setUp();
        boss.arrive({ speedScale: 1, densityScale: 1 });
        run(boss.update, BOSS_ENTER_MS + STEP);
        boss.takeDamage(100);
        boss.update(STEP);
        expect(boss.phase).toBe('breaking');
        expect(boss.lastOutcome).toBe('broken');
        run(boss.update, BOSS_BREAK_MS + STEP);
        expect(boss.phase).toBe('attacking');
        expect(boss.attackIndex).toBe(1);
        expect(boss.attackKind).toBe('cyclone');
    });

    it('ends an attack without breaking it when time runs out', () => {
        const { boss } = setUp();
        boss.arrive({ speedScale: 1, densityScale: 1 });
        run(boss.update, BOSS_ENTER_MS + 5000 + 2 * STEP);
        expect(boss.phase).toBe('breaking');
        expect(boss.lastOutcome).toBe('timed-out');
    });

    it('explodes after its last attack, and is then defeated', () => {
        const { boss } = setUp();
        boss.arrive({ speedScale: 1, densityScale: 1 });
        run(boss.update, BOSS_ENTER_MS + STEP);
        boss.takeDamage(100);
        run(boss.update, BOSS_BREAK_MS + 2 * STEP);
        boss.takeDamage(100);
        boss.update(STEP);
        expect(boss.phase).toBe('exploding');
        run(boss.update, BOSS_EXPLODE_MS + STEP);
        expect(boss.phase).toBe('defeated');
        boss.reset();
        expect(boss.phase).toBe('absent');
    });
});
