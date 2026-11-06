import { describe, expect, it } from 'vitest';
import { advanceTime } from '@mvtjs/html';
import { RESET_MS, SHIFT_STEP } from '../data';
import { createLabModel, type LabModel } from './lab-model';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createLabModel', () => {
    it('has tiles laid from the start, reaching past every corner of the window', () => {
        const lab = createLabModel({ seed: 1 });
        expect(lab.tiling.tiles.count).toBeGreaterThan(0);
        expect(findFurthestMiddle(lab)).toBeGreaterThan(lab.scope.radius);
    });

    it('passes its seed on to the tiling', () => {
        const a = createLabModel({ seed: 7 });
        const b = createLabModel({ seed: 7 });
        a.tiling.pickRandomTiling();
        b.tiling.pickRandomTiling();
        expect(b.tiling.shift).toBe(a.tiling.shift);
    });

    it('moves the tiling and the scope on together', async () => {
        const lab = createLabModel({ seed: 1 });
        lab.tiling.isDrifting = true;
        lab.scope.travelX = 1;
        const { shift } = lab.tiling;
        await advanceTime(500, lab);
        expect(lab.tiling.shift).toBeGreaterThan(shift);
        expect(lab.scope.centreX).toBeGreaterThan(0);
    });

    it('lays the tiles again as the drift passes a step', async () => {
        const lab = createLabModel({ seed: 1 });
        lab.tiling.isDrifting = true;
        const { version } = lab.tiling.tiles;
        await advanceTime((SHIFT_STEP / lab.tiling.morphSpeed) * 1000 * 1.5, lab);
        expect(lab.tiling.tiles.version).toBeGreaterThan(version);
    });

    it('leaves the tiles alone while nothing moves', async () => {
        const lab = createLabModel({ seed: 1 });
        const { version } = lab.tiling.tiles;
        await advanceTime(1000, lab);
        expect(lab.tiling.tiles.version).toBe(version);
    });

    it('lays the tiles for a new symmetry at its next update', async () => {
        const lab = createLabModel({ seed: 1 });
        lab.tiling.symmetry = 8;
        await advanceTime(16, lab);
        expect(lab.tiling.tiles.shapeCount).toBe(2);
        expect(lab.tiling.tiles.pairCount).toBe(6);
    });

    it('keeps tiles under the window as it travels', async () => {
        const lab = createLabModel({ seed: 1 });
        lab.scope.travelX = 1;
        await advanceTime(4000, lab);
        expect(findFurthestMiddle(lab)).toBeGreaterThan(lab.scope.radius);
    });

    it('keeps tiles under the window all the way through a reset from far away', async () => {
        const lab = createLabModel({ seed: 1 });
        lab.scope.moveCentre(5000, 3000);
        await advanceTime(16, lab);
        lab.scope.reset();
        for (let ms = 0; ms < RESET_MS; ms += 100) {
            await advanceTime(100, lab);
            expect(findFurthestMiddle(lab)).toBeGreaterThan(lab.scope.radius);
        }
    });

    it('resets the window without changing the tiling', async () => {
        const lab = createLabModel({ seed: 1 });
        lab.tiling.symmetry = 7;
        lab.scope.moveCentre(10, 10);
        lab.scope.reset();
        await advanceTime(RESET_MS, lab);
        expect(lab.scope.centreX).toBe(0);
        expect(lab.tiling.symmetry).toBe(7);
    });
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * How far the tile middles reach from the window's centre, in the direction
 * they reach least: up, down, left or right. It is past the radius when
 * tiles cover the whole window.
 */
function findFurthestMiddle(lab: LabModel): number {
    const { tiles } = lab.tiling;
    const { centreX, centreY } = lab.scope;
    const reaches = [0, 0, 0, 0];
    for (let i = 0; i < tiles.count; i++) {
        const x = (tiles.cornerXs[i * 4] + tiles.cornerXs[i * 4 + 2]) / 2 - centreX;
        const y = (tiles.cornerYs[i * 4] + tiles.cornerYs[i * 4 + 2]) / 2 - centreY;
        reaches[0] = Math.max(reaches[0], x);
        reaches[1] = Math.max(reaches[1], -x);
        reaches[2] = Math.max(reaches[2], y);
        reaches[3] = Math.max(reaches[3], -y);
    }
    return Math.min(...reaches);
}
