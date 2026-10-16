import { describe, it, expect } from 'vitest';
import { createTerrainModel } from './terrain-model';
import type { SectionProfile } from '../data';

function makeSimpleSection(colCount: number, floorHeight: number, ceilingHeight = 0): SectionProfile {
    return {
        floor: new Array(colCount).fill(floorHeight),
        ceiling: new Array(colCount).fill(ceilingHeight),
        spawns: [],
    };
}

describe('TerrainModel', () => {
    describe('construction', () => {
        it('calculates total columns from all sections', () => {
            const terrain = createTerrainModel({
                sections: [
                    makeSimpleSection(10, 2),
                    makeSimpleSection(20, 3),
                ],
                rows: 14,
            });
            expect(terrain.totalCols).toBe(30);
            expect(terrain.rows).toBe(14);
        });
    });

    describe('getTile', () => {
        it('returns solid for floor tiles', () => {
            const terrain = createTerrainModel({
                sections: [makeSimpleSection(5, 2)],
                rows: 14,
            });
            // Floor height 2 means rows 12,13 are solid (14-2=12)
            expect(terrain.getTile(0, 12)).toBe('solid');
            expect(terrain.getTile(0, 13)).toBe('solid');
            expect(terrain.getTile(0, 11)).toBe('empty');
        });

        it('returns solid for ceiling tiles', () => {
            const terrain = createTerrainModel({
                sections: [makeSimpleSection(5, 0, 3)],
                rows: 14,
            });
            // Ceiling height 3 means rows 0,1,2 are solid
            expect(terrain.getTile(0, 0)).toBe('solid');
            expect(terrain.getTile(0, 2)).toBe('solid');
            expect(terrain.getTile(0, 3)).toBe('empty');
        });

        it('returns empty for out-of-bounds', () => {
            const terrain = createTerrainModel({
                sections: [makeSimpleSection(5, 2)],
                rows: 14,
            });
            expect(terrain.getTile(-1, 0)).toBe('empty');
            expect(terrain.getTile(10, 0)).toBe('empty');
            expect(terrain.getTile(0, -1)).toBe('empty');
            expect(terrain.getTile(0, 14)).toBe('empty');
        });
    });

    describe('isSolid', () => {
        it('returns true for solid tiles', () => {
            const terrain = createTerrainModel({
                sections: [makeSimpleSection(5, 3)],
                rows: 14,
            });
            expect(terrain.isSolid(0, 13)).toBe(true);
            expect(terrain.isSolid(0, 11)).toBe(true);
        });

        it('returns false for empty tiles and out-of-bounds', () => {
            const terrain = createTerrainModel({
                sections: [makeSimpleSection(5, 3)],
                rows: 14,
            });
            expect(terrain.isSolid(0, 10)).toBe(false);
            expect(terrain.isSolid(-1, 13)).toBe(false);
        });
    });

    describe('getSectionIndex', () => {
        it('returns correct section for each column', () => {
            const terrain = createTerrainModel({
                sections: [
                    makeSimpleSection(10, 2),
                    makeSimpleSection(20, 3),
                    makeSimpleSection(15, 1),
                ],
                rows: 14,
            });
            expect(terrain.getSectionIndex(0)).toBe(0);
            expect(terrain.getSectionIndex(9)).toBe(0);
            expect(terrain.getSectionIndex(10)).toBe(1);
            expect(terrain.getSectionIndex(29)).toBe(1);
            expect(terrain.getSectionIndex(30)).toBe(2);
            expect(terrain.getSectionIndex(44)).toBe(2);
        });
    });

    describe('getSurfaceRow', () => {
        it('returns first empty row above floor', () => {
            const terrain = createTerrainModel({
                sections: [makeSimpleSection(5, 3)],
                rows: 14,
            });
            // Floor height 3: rows 11,12,13 solid, row 10 is first empty
            expect(terrain.getSurfaceRow(0)).toBe(10);
        });

        it('handles out-of-bounds columns', () => {
            const terrain = createTerrainModel({
                sections: [makeSimpleSection(5, 3)],
                rows: 14,
            });
            expect(terrain.getSurfaceRow(-1)).toBe(13);
            expect(terrain.getSurfaceRow(10)).toBe(13);
        });

        it('returns 0 for fully solid column', () => {
            const terrain = createTerrainModel({
                sections: [makeSimpleSection(5, 14)],
                rows: 14,
            });
            expect(terrain.getSurfaceRow(0)).toBe(0);
        });
    });

    describe('multi-section tile expansion', () => {
        it('tiles span across sections correctly', () => {
            const terrain = createTerrainModel({
                sections: [
                    makeSimpleSection(3, 2),
                    makeSimpleSection(3, 4),
                ],
                rows: 14,
            });
            // Section 1: floor height 2 -> rows 12,13 solid
            expect(terrain.isSolid(2, 12)).toBe(true);
            expect(terrain.isSolid(2, 11)).toBe(false);
            // Section 2: floor height 4 -> rows 10,11,12,13 solid
            expect(terrain.isSolid(3, 10)).toBe(true);
            expect(terrain.isSolid(3, 9)).toBe(false);
        });
    });
});
