import { describe, expect, it } from 'vitest';
import { createSlotList } from '@mvtjs/utils';
import type { BossAttackDef, BulletKind, EnemyKind } from '../data';
import { createBossModel } from './boss-model';
import { createBulletField } from './bullet-field';
import { createEnemyModel, type EnemyModel } from './enemy-model';
import {
    BOSS_ENTER_MS,
    BULLET_HIT_RADII,
    ENEMY_HEALTH,
    STEP_MS,
    VOLLEY_BOSS_DAMAGE,
    VOLLEY_CHARGE_MS,
    VOLLEY_DAMAGE,
    VOLLEY_FLIGHT_MS,
    VOLLEY_LOCK_MS,
    VOLLEY_RING_FORM_MS,
    VOLLEY_RING_RADIUS,
    VOLLEY_SHOTS,
} from './model-constants';
import { createVolleyModel } from './volley-model';

const ATTACK: BossAttackDef = { kind: 'squall', health: 900, timeLimitMs: 30_000, swayX: 0, swayPeriodMs: 1000, patterns: [] };

function setUp(attacks: readonly BossAttackDef[] = [ATTACK]) {
    const bullets = createBulletField<BulletKind>({ capacity: 64, hitRadii: BULLET_HIT_RADII, width: 240, height: 320, margin: 16 });
    const ship = { x: 120, y: 280, isFocused: false };
    const airEnemies = createSlotList<EnemyModel>({ maxSlots: 8 });
    const groundEnemies = createSlotList<EnemyModel>({ maxSlots: 8 });
    const boss = createBossModel({ attacks, bullets, target: ship });
    const volley = createVolleyModel({ airEnemies, groundEnemies, boss, bullets, ship });

    /** An enemy that hangs still at (x, y), firing nothing. */
    function addEnemy(kind: EnemyKind, x: number, y: number): EnemyModel {
        const enemy = createEnemyModel({
            kind, x, y, path: { kind: 'straight', speed: 0 }, patterns: [], bullets, target: ship, ground: { scrollSpeed: 0 },
        });
        airEnemies.insert(enemy);
        return enemy;
    }

    /** Run the volley, and the boss and enemies with it, for `ms`. */
    function run(ms: number): void {
        const steps = Math.round(ms / STEP_MS);
        for (let i = 0; i < steps; i++) {
            boss.update(STEP_MS);
            airEnemies.forEachLive((enemy) => enemy.update(STEP_MS));
            bullets.update(STEP_MS);
            volley.update(STEP_MS);
        }
    }

    /** A still bullet where shot `i` of the ring is now. */
    function fireAtShot(i: number): void {
        const angle = volley.ringAngle + (i * 2 * Math.PI) / volley.shotCount;
        bullets.fire(ship.x + Math.cos(angle) * volley.ringRadius, ship.y + Math.sin(angle) * volley.ringRadius, 0, 'pellet-red', { speed: 0 });
    }

    /** Charge the volley, focus, and wait for the ring to spread out to its full radius. */
    function raiseRing(): void {
        volley.addGrazeTime(VOLLEY_CHARGE_MS);
        ship.isFocused = true;
        run(VOLLEY_RING_FORM_MS + STEP_MS);
    }

    return { ship, boss, bullets, volley, addEnemy, run, fireAtShot, raiseRing };
}

describe('VolleyModel', () => {
    it('fills its bar with time spent grazing, and takes no more once it is full', () => {
        const { volley } = setUp();
        volley.addGrazeTime(VOLLEY_CHARGE_MS / 2);
        expect(volley.phase).toBe('charging');
        expect(volley.charge).toBeCloseTo(0.5);
        volley.addGrazeTime(VOLLEY_CHARGE_MS);
        expect(volley.phase).toBe('ready');
        expect(volley.charge).toBe(1);
    });

    it('locks onto the toughest enemy on screen while focused, then fires on release', () => {
        const { ship, volley, addEnemy, run } = setUp();
        addEnemy('kite', 40, 100);
        const gunship = addEnemy('gunship', 200, 80);
        volley.addGrazeTime(VOLLEY_CHARGE_MS);
        run(500);
        expect(volley.phase).toBe('ready');

        ship.isFocused = true;
        run(VOLLEY_LOCK_MS / 2);
        expect(volley.phase).toBe('locking');
        expect(volley.lockProgress).toBeCloseTo(0.5, 1);
        expect(volley.targetX).toBe(gunship.x);
        run(VOLLEY_LOCK_MS / 2 + STEP_MS);
        expect(volley.phase).toBe('locked');

        ship.isFocused = false;
        volley.release();
        expect(volley.phase).toBe('flying');
        expect(volley.charge).toBe(0);
        expect(volley.volleysFired).toBe(1);
        expect(volley.launchX).toBe(ship.x);

        run(VOLLEY_FLIGHT_MS + STEP_MS);
        expect(gunship.health).toBe(ENEMY_HEALTH.gunship - VOLLEY_DAMAGE);
        expect(volley.burstCount).toBe(1);
        expect(volley.burstX).toBe(gunship.x);
        expect(volley.phase).toBe('charging');
        expect(volley.charge).toBe(0);
    });

    it('fires nothing when released before the lock is complete, and keeps its bar full', () => {
        const { ship, volley, addEnemy, run } = setUp();
        addEnemy('barge', 120, 80);
        volley.addGrazeTime(VOLLEY_CHARGE_MS);
        ship.isFocused = true;
        run(VOLLEY_LOCK_MS / 2);
        volley.release();
        ship.isFocused = false;
        run(STEP_MS);
        expect(volley.phase).toBe('ready');
        expect(volley.lockProgress).toBe(0);
        expect(volley.charge).toBe(1);
        expect(volley.volleysFired).toBe(0);
    });

    it('locks onto the nearest of two enemies with the same health left', () => {
        const { ship, volley, addEnemy, run } = setUp();
        addEnemy('barge', 30, 60);
        const near = addEnemy('barge', 140, 200);
        volley.addGrazeTime(VOLLEY_CHARGE_MS);
        ship.isFocused = true;
        run(STEP_MS);
        expect(volley.targetX).toBe(near.x);
    });

    it('waits, ready, while there is nothing to lock onto, and locks as soon as there is', () => {
        const { ship, volley, addEnemy, run } = setUp();
        volley.addGrazeTime(VOLLEY_CHARGE_MS);
        ship.isFocused = true;
        run(VOLLEY_LOCK_MS * 2);
        expect(volley.phase).toBe('ready');
        addEnemy('kite', 120, 100);
        run(STEP_MS);
        expect(volley.phase).toBe('locking');
    });

    it('locks again, from the start, onto the next toughest when its target dies', () => {
        const { ship, volley, addEnemy, run } = setUp();
        const kite = addEnemy('kite', 40, 100);
        const barge = addEnemy('barge', 200, 80);
        volley.addGrazeTime(VOLLEY_CHARGE_MS);
        ship.isFocused = true;
        run(VOLLEY_LOCK_MS + STEP_MS);
        expect(volley.phase).toBe('locked');

        barge.takeDamage(ENEMY_HEALTH.barge);
        run(STEP_MS);
        expect(volley.phase).toBe('locking');
        expect(volley.lockProgress).toBeCloseTo(STEP_MS / VOLLEY_LOCK_MS);
        expect(volley.targetX).toBe(kite.x);
    });

    it('bursts where its target was last when the target dies in flight', () => {
        const { ship, volley, addEnemy, run } = setUp();
        const barge = addEnemy('barge', 200, 80);
        volley.addGrazeTime(VOLLEY_CHARGE_MS);
        ship.isFocused = true;
        run(VOLLEY_LOCK_MS + STEP_MS);
        volley.release();
        run(VOLLEY_FLIGHT_MS / 2);
        barge.takeDamage(ENEMY_HEALTH.barge);
        run(VOLLEY_FLIGHT_MS / 2 + STEP_MS);
        expect(volley.burstCount).toBe(1);
        expect(volley.burstX).toBe(barge.x);
        expect(volley.burstY).toBe(barge.y);
    });

    it('locks onto the boss while it can be hurt, which takes less damage', () => {
        const { ship, boss, volley, addEnemy, run } = setUp();
        addEnemy('gunship', 40, 100);
        boss.arrive({ speedScale: 1, densityScale: 1 });
        run(BOSS_ENTER_MS + STEP_MS);
        expect(boss.isVulnerable).toBe(true);

        volley.addGrazeTime(VOLLEY_CHARGE_MS);
        ship.isFocused = true;
        run(VOLLEY_LOCK_MS + STEP_MS);
        expect(volley.targetX).toBe(boss.x);
        volley.release();
        run(VOLLEY_FLIGHT_MS + STEP_MS);
        expect(boss.healthFraction).toBeCloseTo(1 - VOLLEY_BOSS_DAMAGE / ATTACK.health);
    });

    it('drops its lock and empties its bar when emptied, as when the ship is lost', () => {
        const { ship, volley, addEnemy, run } = setUp();
        addEnemy('barge', 120, 80);
        volley.addGrazeTime(VOLLEY_CHARGE_MS);
        ship.isFocused = true;
        run(VOLLEY_LOCK_MS + STEP_MS);
        volley.empty();
        expect(volley.phase).toBe('charging');
        expect(volley.charge).toBe(0);
        expect(volley.lockProgress).toBe(0);
    });

    describe('the ring', () => {
        it('says the bar is filling only in a step it was given time near a bullet', () => {
            const { volley, run } = setUp();
            volley.addGrazeTime(STEP_MS);
            expect(volley.isFilling).toBe(true);
            run(STEP_MS);
            expect(volley.isFilling).toBe(false);
        });

        it('circles the focused ship once charged, and drops when Focus is let go, keeping its shots', () => {
            const { ship, volley, run, raiseRing } = setUp();
            volley.addGrazeTime(VOLLEY_CHARGE_MS);
            run(STEP_MS);
            expect(volley.isRingUp).toBe(false);

            raiseRing();
            expect(volley.isRingUp).toBe(true);
            expect(volley.ringRadius).toBe(VOLLEY_RING_RADIUS);
            const angle = volley.ringAngle;
            run(STEP_MS);
            expect(volley.ringAngle).not.toBe(angle);

            ship.isFocused = false;
            run(STEP_MS);
            expect(volley.isRingUp).toBe(false);
            expect(volley.ringRadius).toBe(0);
            expect(volley.shotsLeft).toBe(VOLLEY_SHOTS);
        });

        it('destroys a bullet that touches one of its shots, and loses that shot', () => {
            const { bullets, volley, run, fireAtShot, raiseRing } = setUp();
            raiseRing();
            fireAtShot(0);
            run(STEP_MS);
            expect(bullets.count).toBe(0);
            expect(volley.hasShotAt(0)).toBe(false);
            expect(volley.shotsLeft).toBe(VOLLEY_SHOTS - 1);
            expect(volley.charge).toBeCloseTo((VOLLEY_SHOTS - 1) / VOLLEY_SHOTS);
            expect(volley.shieldHits).toBe(1);
            expect(volley.msSinceShieldHit).toBeLessThan(STEP_MS);
        });

        it('lets a bullet inside the ring pass, since the ring is around it', () => {
            const { ship, bullets, volley, run, raiseRing } = setUp();
            raiseRing();
            bullets.fire(ship.x, ship.y - 4, 0, 'pellet-red', { speed: 0 });
            run(STEP_MS);
            expect(bullets.count).toBe(1);
            expect(volley.shotsLeft).toBe(VOLLEY_SHOTS);
        });

        it('starts charging again once its last shot is lost', () => {
            const { volley, run, fireAtShot, raiseRing } = setUp();
            raiseRing();
            for (let i = 0; i < VOLLEY_SHOTS; i++) fireAtShot(i);
            run(STEP_MS);
            expect(volley.phase).toBe('charging');
            expect(volley.charge).toBe(0);
            expect(volley.isRingUp).toBe(false);
        });

        it('bursts with a share of its damage for each shot left, flying out from where the ring was', () => {
            const { ship, volley, addEnemy, run, fireAtShot, raiseRing } = setUp();
            const gunship = addEnemy('gunship', 120, 80);
            raiseRing();
            for (let i = 0; i < 3; i++) fireAtShot(i);
            run(VOLLEY_LOCK_MS);
            expect(volley.phase).toBe('locked');

            const { ringAngle, ringRadius } = volley;
            ship.isFocused = false;
            volley.release();
            expect(volley.launchAngle).toBe(ringAngle);
            expect(volley.launchRadius).toBe(ringRadius);
            run(VOLLEY_FLIGHT_MS + STEP_MS);
            expect(gunship.health).toBeCloseTo(ENEMY_HEALTH.gunship - (VOLLEY_DAMAGE * (VOLLEY_SHOTS - 3)) / VOLLEY_SHOTS);
        });
    });
});
