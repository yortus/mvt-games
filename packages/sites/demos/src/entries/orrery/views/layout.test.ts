import { expect, it } from 'vitest';
import { CRANK_PINION_TEETH, DRIVE_WHEEL_TEETH, WORLD_PAIR_TEETH, WORLDS } from '../data';

// Every pair of gears spans the same gap between two arbors. A pair whose
// teeth add up to more or less would clip, or leave a gap, which is easy to
// miss when you retune one world's year by changing one of its gears.
it('puts the same number of teeth in every pair of gears, so each pair meshes across the gap between its arbors', () => {
    const pairs = [CRANK_PINION_TEETH + DRIVE_WHEEL_TEETH, ...WORLDS.map((world) => world.driverTeeth + world.tubeTeeth)];
    expect(pairs.every((teeth) => teeth === WORLD_PAIR_TEETH)).toBe(true);
});
