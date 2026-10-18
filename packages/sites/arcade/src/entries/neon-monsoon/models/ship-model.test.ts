import { describe, expect, it } from 'vitest';
import { createBulletField } from './bullet-field';
import type { ShotKind } from './common';
import { MAX_POWER, SHIP_FOCUSED_SPEED, SHIP_SPEED, SHOT_HIT_RADII, SHOT_INTERVAL_MS } from './model-constants';
import { createShipModel } from './ship-model';

function setUp() {
    const shots = createBulletField<ShotKind>({ capacity: 256, hitRadii: SHOT_HIT_RADII, width: 240, height: 320, margin: 16 });
    const ship = createShipModel({ shots });
    return { shots, ship };
}

describe('ShipModel', () => {
    it('flies the way it is headed, slower while focused', () => {
        const { ship } = setUp();
        const startX = ship.x;
        ship.setHeading('right', 'none');
        ship.update(100);
        expect(ship.x).toBeCloseTo(startX + SHIP_SPEED * 0.1);
        ship.setFocusing(true);
        ship.update(100);
        expect(ship.x).toBeCloseTo(startX + (SHIP_SPEED + SHIP_FOCUSED_SPEED) * 0.1);
    });

    it('is no faster on a diagonal', () => {
        const { ship } = setUp();
        const startX = ship.x;
        const startY = ship.y;
        ship.setHeading('left', 'up');
        ship.update(100);
        expect(Math.hypot(ship.x - startX, ship.y - startY)).toBeCloseTo(SHIP_SPEED * 0.1);
    });

    it('stays inside the arena', () => {
        const { ship } = setUp();
        ship.setHeading('none', 'down');
        for (let i = 0; i < 100; i++) ship.update(100);
        expect(ship.y).toBeLessThanOrEqual(320);
    });

    it('fires a wider spread as its power rises, and a column while focused', () => {
        const { shots, ship } = setUp();
        ship.update(1);
        expect(shots.count).toBe(3);
        ship.powerUp();
        ship.update(SHOT_INTERVAL_MS);
        expect(shots.count).toBe(3 + 5);

        shots.clear();
        ship.setFocusing(true);
        ship.update(SHOT_INTERVAL_MS);
        expect(shots.count).toBe(3);
        expect(shots.kindOf(0)).toBe('shot-focused');
    });

    it('is focused only while alive', () => {
        const { ship } = setUp();
        ship.setFocusing(true);
        expect(ship.isFocused).toBe(true);
        ship.explode();
        expect(ship.isFocused).toBe(false);
    });

    it('stops at full power', () => {
        const { ship } = setUp();
        for (let i = 1; i < MAX_POWER; i++) expect(ship.powerUp()).toBe(true);
        expect(ship.powerUp()).toBe(false);
    });

    it('loses a power level when destroyed, and is invulnerable for a while after respawning', () => {
        const { ship } = setUp();
        ship.powerUp();
        ship.explode();
        expect(ship.isAlive).toBe(false);
        expect(ship.power).toBe(1);
        ship.respawn(1000);
        expect(ship.isInvulnerable).toBe(true);
        ship.update(1000);
        expect(ship.isInvulnerable).toBe(false);
    });
});
