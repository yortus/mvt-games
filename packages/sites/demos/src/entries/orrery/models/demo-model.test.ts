import { describe, expect, it } from 'vitest';
import { advanceTime } from '@mvtjs/pixi';
import { CRANK_PINION_TEETH, MAX_TURNS_PER_SECOND, SETTLE_MS } from '../data';
import { createDemoModel } from './demo-model';

describe('DemoModel', () => {
    it('turns every world the same way as the crank, the nearest fastest', async () => {
        const model = createDemoModel();
        await advanceTime(2000, model);
        const angles = model.worlds.map((world) => world.orbitAngle);
        expect(angles.every((angle) => angle > 0)).toBe(true);
        expect([...angles].sort((a, b) => b - a)).toEqual(angles);
    });

    it('lands the crank in the same place whatever size the steps are', () => {
        const inSmallSteps = createDemoModel();
        const inLargeSteps = createDemoModel();
        inSmallSteps.motorTurnsPerSecond = -2;
        inLargeSteps.motorTurnsPerSecond = -2;
        for (let i = 0; i < 300; i++) inSmallSteps.update(10);
        for (let i = 0; i < 30; i++) inLargeSteps.update(100);
        expect(inLargeSteps.crankAngle).toBeCloseTo(inSmallSteps.crankAngle, 6);
    });

    it('brings the crank round to the motor\'s speed, up to the limit', async () => {
        const model = createDemoModel();
        model.motorTurnsPerSecond = -MAX_TURNS_PER_SECOND * 2;
        await advanceTime(SETTLE_MS * 20, model);
        expect(model.crankTurnsPerSecond).toBeCloseTo(-MAX_TURNS_PER_SECOND, 6);
        expect(model.daysPerSecond).toBeLessThan(0);
    });

    it('counts the teeth that pass turning backwards as well as forwards', async () => {
        const model = createDemoModel();
        model.motorTurnsPerSecond = -1;
        await advanceTime(SETTLE_MS * 20, model);
        const before = model.teethPassed;
        await advanceTime(1000, model);
        // One turn backwards passes every tooth once, give or take the one the second starts or ends on
        expect(Math.abs(model.teethPassed - before - CRANK_PINION_TEETH)).toBeLessThanOrEqual(1);
    });
});
