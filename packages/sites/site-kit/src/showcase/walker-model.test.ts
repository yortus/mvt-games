import { expect, it } from 'vitest';
import { createWalkerModel } from './walker-model';

const RADIUS = 0.3;
const STAND = { x: 0, z: 0, facing: 0 };
const LENGTH = 1;
const WIDTH = 2;

// A long step can land the walker's middle inside a stand, which they must not walk on through
it('pushes a walker whose middle is inside a stand out through its nearest face', () => {
    const walker = createWalkerModel({ radius: RADIUS, walkSpeed: 1, facingCosine: 0.5, startPitch: 0, maxPitch: 1, x: LENGTH / 2 - 0.1, z: 0.2, heading: 0 });
    walker.pushOutOf(STAND, LENGTH, WIDTH);
    // The front, at +x, is nearer than either side, so the walker ends a radius in front of it
    expect(walker.x).toBeCloseTo(LENGTH / 2 + RADIUS, 9);
    expect(walker.z).toBeCloseTo(0.2, 9);
});
