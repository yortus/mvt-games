import { describe, expect, it } from 'vitest';
import { SYMMETRIES } from '../data';
import { createMultigridTiles, type TileSet } from './multigrid-tiles';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createMultigridTiles', () => {
    it.each(SYMMETRIES)('lays rhombi with sides one edge long, for a symmetry of %i', (symmetry) => {
        const tiles = createMultigridTiles();
        tiles.lay(symmetry, 0.3, 0, 0, 10);
        expect(tiles.count).toBeGreaterThan(100);
        for (let i = 0; i < tiles.count; i++) {
            for (let corner = 0; corner < 4; corner++) {
                const [ax, ay] = cornerOf(tiles, i, corner);
                const [bx, by] = cornerOf(tiles, i, (corner + 1) % 4);
                expect(Math.hypot(bx - ax, by - ay)).toBeCloseTo(1, 9);
            }
        }
    });

    it.each(SYMMETRIES)('covers the disc with no gaps and no overlaps, for a symmetry of %i', (symmetry) => {
        // Every point well inside the disc lies in exactly one tile. The
        // points sit at uneven spacings, so none falls on an edge.
        const radius = 9;
        const tiles = createMultigridTiles();
        for (const shift of [0.13, 0.62, 0.88]) {
            tiles.lay(symmetry, shift, 3, -2, radius);
            for (let row = 0; row < 18; row++) {
                for (let col = 0; col < 18; col++) {
                    const x = 3 + (col - 8.5) * 0.71 + row * 0.013;
                    const y = -2 + (row - 8.5) * 0.69 + col * 0.017;
                    if (Math.hypot(x - 3, y + 2) > radius - 2) continue;
                    expect(countTilesHolding(tiles, x, y)).toBe(1);
                }
            }
        }
    });

    it.each(SYMMETRIES)('puts each crossing on the two lines its tile comes from, for a symmetry of %i', (symmetry) => {
        const tiles = createMultigridTiles();
        tiles.lay(symmetry, 0.3, 2, 1, 8);
        for (let i = 0; i < tiles.count; i++) {
            const first = tiles.pairFirstGrids[tiles.pairs[i]];
            const second = tiles.pairSecondGrids[tiles.pairs[i]];
            expect(measureAlong(tiles, i, first)).toBeCloseTo(tiles.gridStarts[first] + tiles.firstLines[i] * tiles.lineSpacing, 9);
            expect(measureAlong(tiles, i, second)).toBeCloseTo(tiles.gridStarts[second] + tiles.secondLines[i] * tiles.lineSpacing, 9);
        }
    });

    it.each(SYMMETRIES)('lays each tile near its crossing, for a symmetry of %i', (symmetry) => {
        const tiles = createMultigridTiles();
        tiles.lay(symmetry, 0.3, 0, 0, 8);
        for (let i = 0; i < tiles.count; i++) {
            const [x, y] = middleOf(tiles, i);
            expect(Math.hypot(x - tiles.crossingXs[i], y - tiles.crossingYs[i])).toBeLessThanOrEqual(tiles.gridCount / 2 + 1);
        }
    });

    it('lays only tiles whose middles lie within the disc', () => {
        const tiles = createMultigridTiles();
        tiles.lay(5, 0.2, 40, 25, 6);
        for (let i = 0; i < tiles.count; i++) {
            const [x, y] = middleOf(tiles, i);
            expect(Math.hypot(x - 40, y - 25)).toBeLessThanOrEqual(6);
        }
    });

    it('lays thick and thin Penrose rhombi in the golden ratio', () => {
        // In a Penrose tiling there are 1.618... thick rhombi for every thin
        // one, however the grids are shifted.
        const goldenRatio = (1 + Math.sqrt(5)) / 2;
        for (const shift of [0, 0.37, 0.81]) {
            const tiles = createMultigridTiles();
            tiles.lay(5, shift, 0, 0, 40);
            expect(tiles.shapeCount).toBe(2);
            let thin = 0;
            let thick = 0;
            for (let i = 0; i < tiles.count; i++) {
                if (tiles.shapes[i] === 0) thin++;
                else thick++;
            }
            expect(thick / thin).toBeCloseTo(goldenRatio, 1);
        }
    });

    it.each(SYMMETRIES)('gives each tile a shape and a pair of grids in range, for a symmetry of %i', (symmetry) => {
        const tiles = createMultigridTiles();
        tiles.lay(symmetry, 0.5, 0, 0, 8);
        const seenShapes = new Set<number>();
        for (let i = 0; i < tiles.count; i++) {
            expect(tiles.shapes[i]).toBeLessThan(tiles.shapeCount);
            expect(tiles.pairs[i]).toBeLessThan(tiles.pairCount);
            seenShapes.add(tiles.shapes[i]);
        }
        expect(seenShapes.size).toBe(tiles.shapeCount);
        for (let pair = 0; pair < tiles.pairCount; pair++) {
            expect(tiles.pairHeadings[pair]).toBeGreaterThanOrEqual(0);
            expect(tiles.pairHeadings[pair]).toBeLessThan(1);
        }
    });

    it('orders the shapes from the thinnest to the squarest', () => {
        const tiles = createMultigridTiles();
        tiles.lay(12, 0.5, 0, 0, 8);
        const areas = [0, 0, 0];
        for (let i = 0; i < tiles.count; i++) areas[tiles.shapes[i]] = areaOf(tiles, i);
        // A rhombus with sides of 1 has the sine of its corner's angle for an area: 30, 60 and 90 degrees here
        expect(areas[0]).toBeCloseTo(Math.sin(Math.PI / 6), 9);
        expect(areas[1]).toBeCloseTo(Math.sin(Math.PI / 3), 9);
        expect(areas[2]).toBeCloseTo(1, 9);
    });

    it('flips some tiles for a small shift, and leaves most where they are', () => {
        // Tiles flip in bursts, at particular shifts, so the shift is wide
        // enough to take in one.
        const before = createMultigridTiles();
        const after = createMultigridTiles();
        before.lay(5, 0.3, 0, 0, 12);
        after.lay(5, 0.33, 0, 0, 12);
        const keysBefore = new Set(listTileKeys(before));
        const keysAfter = listTileKeys(after);
        let kept = 0;
        for (const key of keysAfter) if (keysBefore.has(key)) kept++;
        expect(kept).toBeLessThan(keysAfter.length);
        expect(kept / keysAfter.length).toBeGreaterThan(0.6);
    });

    it('lays more tiles than it first has room for', () => {
        const tiles = createMultigridTiles();
        tiles.lay(5, 0.1, 0, 0, 3);
        const firstArray = tiles.cornerXs;
        tiles.lay(5, 0.1, 0, 0, 40);
        expect(tiles.cornerXs).not.toBe(firstArray);
        expect(tiles.cornerXs.length).toBeGreaterThanOrEqual(tiles.count * 4);
    });

    it('counts each lay in its version', () => {
        const tiles = createMultigridTiles();
        tiles.lay(5, 0, 0, 0, 5);
        const version = tiles.version;
        tiles.lay(7, 0, 0, 0, 5);
        expect(tiles.version).toBe(version + 1);
    });

    it('refuses a symmetry it has no grids for', () => {
        const tiles = createMultigridTiles();
        expect(() => tiles.lay(2, 0, 0, 0, 5)).toThrow(/symmetry of 2/);
    });
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function cornerOf(tiles: TileSet, tile: number, corner: number): [number, number] {
    return [tiles.cornerXs[tile * 4 + corner], tiles.cornerYs[tile * 4 + corner]];
}

function middleOf(tiles: TileSet, tile: number): [number, number] {
    const [ax, ay] = cornerOf(tiles, tile, 0);
    const [cx, cy] = cornerOf(tiles, tile, 2);
    return [(ax + cx) / 2, (ay + cy) / 2];
}

/** How far a tile's crossing lies along the way `grid`'s lines step, from the tiling's origin. */
function measureAlong(tiles: TileSet, tile: number, grid: number): number {
    return tiles.crossingXs[tile] * tiles.gridCosines[grid] + tiles.crossingYs[tile] * tiles.gridSines[grid];
}

function areaOf(tiles: TileSet, tile: number): number {
    const [ax, ay] = cornerOf(tiles, tile, 0);
    const [bx, by] = cornerOf(tiles, tile, 1);
    const [dx, dy] = cornerOf(tiles, tile, 3);
    return Math.abs((bx - ax) * (dy - ay) - (by - ay) * (dx - ax));
}

/** How many tiles have the point (`x`, `y`) inside them. */
function countTilesHolding(tiles: TileSet, x: number, y: number): number {
    let holding = 0;
    for (let i = 0; i < tiles.count; i++) {
        let sign = 0;
        let isInside = true;
        for (let corner = 0; corner < 4; corner++) {
            const [ax, ay] = cornerOf(tiles, i, corner);
            const [bx, by] = cornerOf(tiles, i, (corner + 1) % 4);
            const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
            const side = Math.sign(cross);
            if (sign === 0) sign = side;
            else if (side !== sign) {
                isInside = false;
                break;
            }
        }
        if (isInside) holding++;
    }
    return holding;
}

/** A key for each tile, from its middle and its shape, rounded so that the same tile laid twice gives the same key. */
function listTileKeys(tiles: TileSet): string[] {
    const keys: string[] = [];
    for (let i = 0; i < tiles.count; i++) {
        const [x, y] = middleOf(tiles, i);
        keys.push(`${x.toFixed(4)},${y.toFixed(4)},${tiles.pairs[i]}`);
    }
    return keys;
}
