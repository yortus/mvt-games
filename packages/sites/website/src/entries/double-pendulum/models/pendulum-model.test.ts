import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPendulumModel, type PendulumModel } from './pendulum-model';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('the double pendulum', () => {
    it('swings the same however its time is split into frames', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const short = createPendulumModel();
        const long = createPendulumModel();
        run(short, 4000, 16);
        run(long, 4000, 40);
        expect(short.angle1).toBe(long.angle1);
        expect(short.angle2).toBe(long.angle2);
    });

    it('stands still while paused, and moves one frame for each step', () => {
        const model = createPendulumModel();
        model.playback = 'paused';
        const angle = model.angle1;
        run(model, 1000, 16);
        expect(model.angle1).toBe(angle);

        model.step();
        model.update(16);
        expect(model.time).toBeGreaterThan(0);
        expect(model.time).toBeLessThan(0.02);
    });

    it('runs at a quarter speed when slow, and twice as fast when fast', () => {
        const slow = createPendulumModel();
        slow.playback = 'slow';
        run(slow, 960, 16);
        expect(slow.time).toBeCloseTo(0.24, 3);

        const fast = createPendulumModel();
        fast.playback = 'fast';
        run(fast, 960, 16);
        expect(fast.time).toBeCloseTo(1.92, 3);
    });

    it('never swings higher than it started, so gains no energy', () => {
        const model = createPendulumModel();
        // Height energy per unit of mass and gravity, for two arms of equal weight
        const heightOf = () => -2 * model.length1 * Math.cos(model.angle1) - model.length2 * Math.cos(model.angle2);
        const start = heightOf();
        for (let ms = 0; ms < 30_000; ms += 16) {
            model.update(16);
            expect(heightOf()).toBeLessThan(start + 1e-4);
        }
    });
});

function run(model: PendulumModel, totalMs: number, frameMs: number): void {
    for (let ms = 0; ms < totalMs; ms += frameMs) model.update(frameMs);
}
