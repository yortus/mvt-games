import { describe, expect, it } from 'vitest';
import type { BulletKind, PatternDef } from '../data';
import { createBulletField } from './bullet-field';
import { BULLET_HIT_RADII } from './model-constants';
import { createEmitterModel } from './emitter-model';

function setUp(pattern: PatternDef, densityScale = 1) {
    const bullets = createBulletField<BulletKind>({ capacity: 512, hitRadii: BULLET_HIT_RADII, width: 240, height: 320, margin: 16 });
    const origin = { x: 120, y: 50 };
    const target = { x: 120, y: 250 };
    const emitter = createEmitterModel({ pattern, bullets, origin, target, densityScale });
    return { bullets, origin, target, emitter };
}

const MOTION = { speed: 50 };

describe('EmitterModel', () => {
    it('fires a ring of evenly spaced bullets, then turns the next ring by its spin', () => {
        const { bullets, emitter } = setUp({
            kind: 'ring', count: 24, spinPerVolleyDeg: 5, angleDeg: 0, bullet: 'pellet-red', motion: MOTION, intervalMs: 100,
        });
        emitter.update(1);
        expect(bullets.count).toBe(24);
        for (let i = 0; i < 24; i++) expect(bullets.angleOf(i)).toBeCloseTo((i * 15 * Math.PI) / 180);

        emitter.update(100);
        expect(bullets.count).toBe(48);
        expect(bullets.angleOf(24)).toBeCloseTo((5 * Math.PI) / 180);
    });

    it('waits for its delay, then fires every interval', () => {
        const { bullets, emitter } = setUp({
            kind: 'ring', count: 1, bullet: 'pellet-red', motion: { speed: 0 }, intervalMs: 100, delayMs: 250,
        });
        emitter.update(200);
        expect(bullets.count).toBe(0);
        emitter.update(50);
        expect(bullets.count).toBe(1);
        emitter.update(300);
        expect(bullets.count).toBe(4);
    });

    it('fires more often when denser', () => {
        const { bullets, emitter } = setUp({
            kind: 'ring', count: 1, bullet: 'pellet-red', motion: { speed: 0 }, intervalMs: 100,
        }, 2);
        emitter.update(1);
        emitter.update(100);
        expect(bullets.count).toBe(3);
    });

    it('centres an aimed fan on the target', () => {
        const { bullets, origin, target, emitter } = setUp({
            kind: 'fan', count: 5, spreadDeg: 40, isAimed: true, bullet: 'needle-orange', motion: MOTION, intervalMs: 1000,
        });
        target.x = 220;
        emitter.update(1);
        expect(bullets.count).toBe(5);
        const aim = Math.atan2(target.y - origin.y, target.x - origin.x);
        expect(bullets.angleOf(2)).toBeCloseTo(aim);
        expect(bullets.angleOf(0)).toBeCloseTo(aim - (20 * Math.PI) / 180);
        expect(bullets.angleOf(4)).toBeCloseTo(aim + (20 * Math.PI) / 180);
    });

    it('fires a stream one bullet at a time, each aimed as it is fired', () => {
        const { bullets, target, emitter } = setUp({
            kind: 'stream', burst: 3, burstGapMs: 50, isAimed: true, bullet: 'needle-orange', motion: { speed: 0 }, intervalMs: 1000,
        });
        emitter.update(1);
        expect(bullets.count).toBe(1);
        target.x = 0;
        emitter.update(50);
        emitter.update(50);
        expect(bullets.count).toBe(3);
        expect(bullets.angleOf(0)).toBeCloseTo(Math.PI / 2);
        expect(bullets.angleOf(2)).toBeGreaterThan(Math.PI / 2);
    });

    it('rains from the top across every lane but the gap, and drifts the gap', () => {
        const { bullets, emitter } = setUp({
            kind: 'rain', lanes: 12, gapLanes: 3, gapDriftPerVolley: 1, bullet: 'rain', motion: { speed: 0 }, intervalMs: 100,
        });
        emitter.update(1);
        expect(bullets.count).toBe(9);
        const firstXs = collectXs();
        emitter.update(100);
        const secondXs = collectXs().slice(9);
        expect(secondXs).not.toEqual(firstXs);
        for (let i = 0; i < bullets.count; i++) expect(bullets.yOf(i)).toBeLessThan(0);

        function collectXs(): number[] {
            const xs: number[] = [];
            for (let i = 0; i < bullets.count; i++) xs.push(bullets.xOf(i));
            return xs;
        }
    });

    it('finishes after its duration', () => {
        const { bullets, emitter } = setUp({
            kind: 'ring', count: 1, bullet: 'pellet-red', motion: { speed: 0 }, intervalMs: 100, durationMs: 250,
        });
        for (let i = 0; i < 10; i++) emitter.update(100);
        expect(emitter.isFinished).toBe(true);
        expect(bullets.count).toBe(3);
    });

    it('fires a volley on demand', () => {
        const { bullets, emitter } = setUp({
            kind: 'ring', count: 8, bullet: 'pellet-gold', motion: MOTION, intervalMs: 1000,
        });
        emitter.fireVolley();
        expect(bullets.count).toBe(8);
    });
});
