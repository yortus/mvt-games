import { describe, it, expect } from 'vitest';
import { createExplosionModel } from './explosion-model';

describe('ExplosionModel', () => {
    describe('initial state', () => {
        it('starts inactive with zero progress', () => {
            const e = createExplosionModel({ durationMs: 400 });
            expect(e.active).toBe(false);
            expect(e.progress).toBe(0);
        });
    });

    describe('spawn', () => {
        it('activates at given position with zero progress', () => {
            const e = createExplosionModel({ durationMs: 400 });
            e.spawn(10, 5);
            expect(e.active).toBe(true);
            expect(e.worldCol).toBe(10);
            expect(e.worldRow).toBe(5);
            expect(e.progress).toBe(0);
        });
    });

    describe('update', () => {
        it('advances progress toward 1', () => {
            const e = createExplosionModel({ durationMs: 400 });
            e.spawn(10, 5);
            e.update(200);
            expect(e.progress).toBeCloseTo(0.5, 5);
            expect(e.active).toBe(true);
        });

        it('deactivates when duration completes', () => {
            const e = createExplosionModel({ durationMs: 400 });
            e.spawn(10, 5);
            e.update(400);
            expect(e.active).toBe(false);
        });

        it('deactivates when overshooting duration', () => {
            const e = createExplosionModel({ durationMs: 400 });
            e.spawn(10, 5);
            e.update(500);
            expect(e.active).toBe(false);
        });

        it('does not advance when inactive', () => {
            const e = createExplosionModel({ durationMs: 400 });
            e.update(200);
            expect(e.progress).toBe(0);
        });
    });

    describe('reuse', () => {
        it('can be spawned again after completing', () => {
            const e = createExplosionModel({ durationMs: 400 });
            e.spawn(10, 5);
            e.update(500);
            expect(e.active).toBe(false);

            e.spawn(20, 8);
            expect(e.active).toBe(true);
            expect(e.worldCol).toBe(20);
            expect(e.worldRow).toBe(8);
            expect(e.progress).toBe(0);
        });
    });
});
