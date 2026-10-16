import { describe, expect, it } from 'vitest';
import { WATER_Y } from '../data';
import { createFireworksModel, type FireworksModel } from './fireworks-model';

describe('the fireworks show', () => {
    it('sends rockets up from the water, and bursts each into sparks above it', () => {
        const model = createFireworksModel();
        model.update(16);
        expect(model.rockets.some((rocket) => rocket.isFlying)).toBe(true);
        run(model, 3000);
        const lit = model.sparks.filter((spark) => spark.life > 0);
        expect(lit.length).toBeGreaterThan(0);
        for (const spark of lit) expect(spark.y).toBeLessThan(WATER_Y);
    });

    it('lets each spark fade, and go out', () => {
        const model = createFireworksModel();
        run(model, 3000);
        const spark = model.sparks.find((s) => s.life > 0);
        const life = spark?.life ?? 0;
        model.update(16);
        expect(spark?.life).toBeLessThan(life);
        run(model, 2000);
        expect(spark?.life ?? 0).toBeLessThanOrEqual(0);
    });
});

function run(model: FireworksModel, totalMs: number): void {
    for (let ms = 0; ms < totalMs; ms += 16) model.update(16);
}
