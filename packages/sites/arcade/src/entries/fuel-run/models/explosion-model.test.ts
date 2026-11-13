import { describe, it, expect } from 'vitest';
import { createExplosionModel } from './explosion-model';

function makeExplosion() {
    return createExplosionModel({ worldCol: 10, worldRow: 5, durationMs: 400 });
}

describe('ExplosionModel', () => {
    describe('update', () => {
        it('clamps progress at 1 when overshooting duration', () => {
            const e = makeExplosion();
            e.update(500);
            expect(e.progress).toBe(1);
        });
    });
});
