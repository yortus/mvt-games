import { describe, it, expect } from 'vitest';
import { createExplosionModel } from './explosion-model';

function makeExplosion() {
    return createExplosionModel({ worldCol: 10, worldRow: 5, durationMs: 400 });
}

describe('ExplosionModel', () => {
    describe('initial state', () => {
        it('starts at given position with zero progress', () => {
            const e = makeExplosion();
            expect(e.worldCol).toBe(10);
            expect(e.worldRow).toBe(5);
            expect(e.progress).toBe(0);
        });
    });

    describe('update', () => {
        it('advances progress toward 1', () => {
            const e = makeExplosion();
            e.update(200);
            expect(e.progress).toBeCloseTo(0.5, 5);
        });

        it('reaches 1 when duration completes', () => {
            const e = makeExplosion();
            e.update(400);
            expect(e.progress).toBe(1);
        });

        it('clamps progress at 1 when overshooting duration', () => {
            const e = makeExplosion();
            e.update(500);
            expect(e.progress).toBe(1);
        });
    });
});
