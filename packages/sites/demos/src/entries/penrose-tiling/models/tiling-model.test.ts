import { describe, expect, it } from 'vitest';
import { advanceTime } from '@mvtjs/html';
import {
    DEFAULT_RADIUS,
    DEFAULT_SYMMETRY,
    MAX_MORPH_SPEED,
    SHIFT_STEP,
    SYMMETRIES,
} from '../data';
import type { TileSet } from './multigrid-tiles';
import { createTilingModel, type TilingModel } from './tiling-model';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createTilingModel', () => {
    it('starts as the Penrose tiling, holding still, with no tiles laid', () => {
        const tiling = createTilingModel({ seed: 1 });
        expect(tiling.symmetry).toBe(DEFAULT_SYMMETRY);
        expect(tiling.isDrifting).toBe(false);
        expect(tiling.tiles.count).toBe(0);
    });

    it('starts on a step of the shift, so that it opens as one clean tiling', () => {
        expect(createTilingModel({ seed: 1 }).tileBlend).toBe(0);
    });

    describe('while drifting', () => {
        it('shifts the grids', async () => {
            const tiling = createDriftingTiling();
            const shift = tiling.shift;
            await advanceTime(1000, tiling);
            expect(tiling.shift).toBeCloseTo(shift + tiling.morphSpeed, 6);
        });

        it('comes back round after a whole shift', async () => {
            const tiling = createDriftingTiling();
            tiling.morphSpeed = MAX_MORPH_SPEED;
            tiling.shift = 0.99;
            await advanceTime(1000, tiling);
            expect(tiling.shift).toBeGreaterThanOrEqual(0);
            expect(tiling.shift).toBeLessThan(0.1);
        });
    });

    it('holds still while not drifting', async () => {
        const tiling = createDriftingTiling();
        tiling.isDrifting = false;
        const shift = tiling.shift;
        await advanceTime(1000, tiling);
        expect(tiling.shift).toBe(shift);
    });

    describe('laying tiles', () => {
        it('lays tiles over the disc it is asked for', () => {
            const tiling = createTilingModel({ seed: 1 });
            layAtMiddle(tiling);
            expect(tiling.tiles.count).toBeGreaterThan(0);
            expect(tiling.nextTiles.count).toBeGreaterThan(0);
        });

        it('lays them again as the shift passes a step', () => {
            const tiling = createTilingModel({ seed: 1 });
            tiling.shift = 10.5 * SHIFT_STEP;
            layAtMiddle(tiling);
            const { version } = tiling.tiles;
            tiling.shift = 11.5 * SHIFT_STEP;
            layAtMiddle(tiling);
            expect(tiling.tiles.version).toBeGreaterThan(version);
        });

        it('leaves the tiles alone between steps, and only the blend moves', () => {
            const tiling = createTilingModel({ seed: 1 });
            tiling.shift = 10 * SHIFT_STEP;
            layAtMiddle(tiling);
            const { version } = tiling.tiles;
            tiling.shift = 10.25 * SHIFT_STEP;
            layAtMiddle(tiling);
            expect(tiling.tileBlend).toBeCloseTo(0.25, 9);
            tiling.shift = 10.75 * SHIFT_STEP;
            layAtMiddle(tiling);
            expect(tiling.tileBlend).toBeCloseTo(0.75, 9);
            expect(tiling.tiles.version).toBe(version);
        });

        it('never jumps as a step passes: the tiles it arrives at are the ones it was heading for', () => {
            const tiling = createTilingModel({ seed: 1 });
            tiling.shift = 40.9 * SHIFT_STEP;
            layAtMiddle(tiling);
            const headingFor = listCorners(tiling.nextTiles);
            tiling.shift = 41.1 * SHIFT_STEP;
            layAtMiddle(tiling);
            expect(listCorners(tiling.tiles)).toEqual(headingFor);
        });

        it('never jumps as the shift comes back round to the start', () => {
            const tiling = createTilingModel({ seed: 1 });
            tiling.shift = 1 - SHIFT_STEP / 2;
            layAtMiddle(tiling);
            const headingFor = listCorners(tiling.nextTiles);
            tiling.shift = SHIFT_STEP / 2;
            layAtMiddle(tiling);
            const arrivedAt = listCorners(tiling.tiles);
            expect(arrivedAt.length).toBe(headingFor.length);
            for (let i = 0; i < arrivedAt.length; i++) expect(arrivedAt[i]).toBeCloseTo(headingFor[i], 9);
        });

        it('has some tiles that differ between the two steps, and most that stay', () => {
            const tiling = createTilingModel({ seed: 1 });
            let kept = 0;
            let total = 0;
            for (let step = 0; step < 40; step++) {
                tiling.shift = (step + 0.5) * SHIFT_STEP;
                layAtMiddle(tiling);
                const before = new Set(listMiddles(tiling.tiles));
                const after = listMiddles(tiling.nextTiles);
                total += after.length;
                for (const middle of after) if (before.has(middle)) kept++;
            }
            expect(kept).toBeLessThan(total);
            expect(kept / total).toBeGreaterThan(0.9);
        });

        it('leaves the tiles alone while the disc stays within them', () => {
            const tiling = createTilingModel({ seed: 1 });
            layAtMiddle(tiling);
            const { version } = tiling.tiles;
            tiling.layTilesOver(1, 1, DEFAULT_RADIUS);
            expect(tiling.tiles.version).toBe(version);
        });

        it('lays them again once the disc strays out of them', () => {
            const tiling = createTilingModel({ seed: 1 });
            layAtMiddle(tiling);
            const { version } = tiling.tiles;
            tiling.layTilesOver(DEFAULT_RADIUS * 2, 0, DEFAULT_RADIUS);
            expect(tiling.tiles.version).toBeGreaterThan(version);
        });

        it('lays fewer once the disc closes in so far that most are wasted', () => {
            const tiling = createTilingModel({ seed: 1 });
            layAtMiddle(tiling);
            const { count } = tiling.tiles;
            tiling.layTilesOver(0, 0, DEFAULT_RADIUS / 4);
            expect(tiling.tiles.count).toBeLessThan(count);
        });

        it('lays the tiles of a new symmetry', () => {
            const tiling = createTilingModel({ seed: 1 });
            layAtMiddle(tiling);
            tiling.symmetry = 8;
            layAtMiddle(tiling);
            expect(tiling.tiles.shapeCount).toBe(2);
            expect(tiling.tiles.pairCount).toBe(6);
        });
    });

    it('takes the nearest symmetry it has to any number', () => {
        const tiling = createTilingModel({ seed: 1 });
        tiling.symmetry = 6;
        expect(SYMMETRIES).toContain(tiling.symmetry);
        tiling.symmetry = 100;
        expect(tiling.symmetry).toBe(SYMMETRIES[SYMMETRIES.length - 1]);
        tiling.symmetry = -3;
        expect(tiling.symmetry).toBe(SYMMETRIES[0]);
    });

    it('keeps its morph speed within its range', () => {
        const tiling = createTilingModel({ seed: 1 });
        tiling.morphSpeed = 1;
        expect(tiling.morphSpeed).toBe(MAX_MORPH_SPEED);
    });

    describe('picking a tile', () => {
        it('picks a tile, and lets it go for -1', () => {
            const tiling = createLaidTiling();
            tiling.pickTile(5);
            expect(tiling.pickedTile).toBe(5);
            tiling.pickTile(-1);
            expect(tiling.pickedTile).toBe(-1);
        });

        it('lets go for a tile that isn\'t there', () => {
            const tiling = createLaidTiling();
            tiling.pickTile(5);
            tiling.pickTile(tiling.tiles.count);
            expect(tiling.pickedTile).toBe(-1);
        });

        it('keeps a tile picked as the tiles are laid again', () => {
            const tiling = createLaidTiling();
            tiling.pickTile(findTileAtMiddle(tiling));
            const first = tiling.tiles.firstLines[tiling.pickedTile];
            const second = tiling.tiles.secondLines[tiling.pickedTile];
            // Far enough to lay the tiles again, and near enough to keep this one
            const { version } = tiling.tiles;
            tiling.layTilesOver(DEFAULT_RADIUS, 0, DEFAULT_RADIUS);
            expect(tiling.tiles.version).toBeGreaterThan(version);
            expect(tiling.tiles.firstLines[tiling.pickedTile]).toBe(first);
            expect(tiling.tiles.secondLines[tiling.pickedTile]).toBe(second);
        });

        it('lets a picked tile go with a new symmetry', () => {
            const tiling = createLaidTiling();
            tiling.pickTile(5);
            tiling.symmetry = 7;
            layAtMiddle(tiling);
            expect(tiling.pickedTile).toBe(-1);
        });
    });

    it('picks a tiling at random, the same each time from a seed', () => {
        const a = createTilingModel({ seed: 7 });
        const b = createTilingModel({ seed: 7 });
        a.pickRandomTiling();
        b.pickRandomTiling();
        expect(SYMMETRIES).toContain(a.symmetry);
        expect(b.symmetry).toBe(a.symmetry);
        expect(b.shift).toBe(a.shift);
    });
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function layAtMiddle(tiling: TilingModel): void {
    tiling.layTilesOver(0, 0, DEFAULT_RADIUS);
}

function createLaidTiling(): TilingModel {
    const tiling = createTilingModel({ seed: 1 });
    layAtMiddle(tiling);
    return tiling;
}

function createDriftingTiling(): TilingModel {
    const tiling = createTilingModel({ seed: 1 });
    tiling.isDrifting = true;
    return tiling;
}

/** The tile with its middle nearest the middle of the tiling. */
function findTileAtMiddle(tiling: TilingModel): number {
    const { tiles } = tiling;
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < tiles.count; i++) {
        const distance = Math.hypot(tiles.cornerXs[i * 4] + tiles.cornerXs[i * 4 + 2], tiles.cornerYs[i * 4] + tiles.cornerYs[i * 4 + 2]);
        if (distance >= nearestDistance) continue;
        nearestDistance = distance;
        nearest = i;
    }
    return nearest;
}

function listCorners(tiles: TileSet): number[] {
    return [...tiles.cornerXs.subarray(0, tiles.count * 4), ...tiles.cornerYs.subarray(0, tiles.count * 4)];
}

/** A key for each tile, from its middle and its direction, rounded so that the same tile laid twice gives the same key. */
function listMiddles(tiles: TileSet): string[] {
    const keys: string[] = [];
    for (let i = 0; i < tiles.count; i++) {
        const x = (tiles.cornerXs[i * 4] + tiles.cornerXs[i * 4 + 2]) / 2;
        const y = (tiles.cornerYs[i * 4] + tiles.cornerYs[i * 4 + 2]) / 2;
        keys.push(`${x.toFixed(4)},${y.toFixed(4)},${tiles.pairs[i]}`);
    }
    return keys;
}
