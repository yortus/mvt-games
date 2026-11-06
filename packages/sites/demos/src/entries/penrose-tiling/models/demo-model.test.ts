import { describe, expect, it } from 'vitest';
import { advanceTime } from '@mvtjs/html';
import { RESET_MS, SHIFT_STEP } from '../data';
import { createDemoModel, type DemoModel } from './demo-model';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createDemoModel', () => {
    it('has tiles laid from the start, reaching past every corner of the window', () => {
        const model = createDemoModel({ seed: 1 });
        expect(model.tiling.tiles.count).toBeGreaterThan(0);
        expect(findFurthestMiddle(model)).toBeGreaterThan(model.scope.radius);
    });

    it('passes its seed on to the tiling', () => {
        const a = createDemoModel({ seed: 7 });
        const b = createDemoModel({ seed: 7 });
        a.tiling.pickRandomTiling();
        b.tiling.pickRandomTiling();
        expect(b.tiling.shift).toBe(a.tiling.shift);
    });

    it('moves the tiling and the scope on together', async () => {
        const model = createDemoModel({ seed: 1 });
        model.tiling.isDrifting = true;
        model.scope.travelX = 1;
        const { shift } = model.tiling;
        await advanceTime(500, model);
        expect(model.tiling.shift).toBeGreaterThan(shift);
        expect(model.scope.centreX).toBeGreaterThan(0);
    });

    it('lays the tiles again as the drift passes a step', async () => {
        const model = createDemoModel({ seed: 1 });
        model.tiling.isDrifting = true;
        const { version } = model.tiling.tiles;
        await advanceTime((SHIFT_STEP / model.tiling.morphSpeed) * 1000 * 1.5, model);
        expect(model.tiling.tiles.version).toBeGreaterThan(version);
    });

    it('leaves the tiles alone while nothing moves', async () => {
        const model = createDemoModel({ seed: 1 });
        const { version } = model.tiling.tiles;
        await advanceTime(1000, model);
        expect(model.tiling.tiles.version).toBe(version);
    });

    it('lays the tiles for a new symmetry at its next update', async () => {
        const model = createDemoModel({ seed: 1 });
        model.tiling.symmetry = 8;
        await advanceTime(16, model);
        expect(model.tiling.tiles.shapeCount).toBe(2);
        expect(model.tiling.tiles.pairCount).toBe(6);
    });

    it('keeps tiles under the window as it travels', async () => {
        const model = createDemoModel({ seed: 1 });
        model.scope.travelX = 1;
        await advanceTime(4000, model);
        expect(findFurthestMiddle(model)).toBeGreaterThan(model.scope.radius);
    });

    it('keeps tiles under the window all the way through a reset from far away', async () => {
        const model = createDemoModel({ seed: 1 });
        model.scope.moveCentre(5000, 3000);
        await advanceTime(16, model);
        model.scope.reset();
        for (let ms = 0; ms < RESET_MS; ms += 100) {
            await advanceTime(100, model);
            expect(findFurthestMiddle(model)).toBeGreaterThan(model.scope.radius);
        }
    });

    it('resets the window without changing the tiling', async () => {
        const model = createDemoModel({ seed: 1 });
        model.tiling.symmetry = 7;
        model.scope.moveCentre(10, 10);
        model.scope.reset();
        await advanceTime(RESET_MS, model);
        expect(model.scope.centreX).toBe(0);
        expect(model.tiling.symmetry).toBe(7);
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
function findFurthestMiddle(model: DemoModel): number {
    const { tiles } = model.tiling;
    const { centreX, centreY } = model.scope;
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
