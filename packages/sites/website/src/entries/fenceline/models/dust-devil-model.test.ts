import { describe, expect, it } from 'vitest';
import { createDustDevilModel, type DevilTarget } from './dust-devil-model';
import { createFieldModel } from './field-model';
import { DEVIL_BLOW_OUT_MS, DEVIL_FULL_ROOM, DEVIL_MIN_SIZE, DEVIL_RADIUS } from './model-constants';
import { createRandom } from './random';

const STEP_MS = 1000 / 60;
const NO_TARGET: DevilTarget = { row: 0, col: 0, isExposed: false };

describe('DustDevilModel', () => {
    it('whirls about its own region, never crossing a fence', () => {
        const field = createFieldModel({ rows: 20, cols: 30, obstacles: [] });
        // A fence down the middle, splitting the meadow in two
        const rows = Array.from({ length: 21 }, (_, i) => i);
        field.addFence(rows, rows.map(() => 15), 21);
        const devil = createDustDevilModel({
            row: 10, col: 7, speed: 12, chase: 0, target: NO_TARGET, random: createRandom({ seed: 7 }), regionAt: field.regionAt,
        });
        const home = field.regionAt(10, 7);
        let minCol = Infinity;
        let maxCol = -Infinity;
        for (let elapsed = 0; elapsed < 20_000; elapsed += STEP_MS) {
            devil.update(STEP_MS);
            expect(field.regionAt(Math.floor(devil.row), Math.floor(devil.col))).toBe(home);
            minCol = Math.min(minCol, devil.col);
            maxCol = Math.max(maxCol, devil.col);
        }
        // It wanders across its region, not round one spot
        expect(maxCol - minCol).toBeGreaterThan(5);
    });

    it('leans towards an exposed target', () => {
        const field = createFieldModel({ rows: 40, cols: 40, obstacles: [] });
        const target: DevilTarget = { row: 35, col: 35, isExposed: true };
        const devil = createDustDevilModel({
            row: 5, col: 5, speed: 6, chase: 1, target, random: createRandom({ seed: 3 }), regionAt: field.regionAt,
        });
        for (let elapsed = 0; elapsed < 4000; elapsed += STEP_MS) devil.update(STEP_MS);
        expect(devil.row).toBeGreaterThan(10);
        expect(devil.col).toBeGreaterThan(10);
    });

    it('shrinks with less room, and starves close to blowing out', () => {
        const field = createFieldModel({ rows: 20, cols: 30, obstacles: [] });
        const devil = createDustDevilModel({
            row: 10, col: 10, speed: 6, chase: 0, target: NO_TARGET, random: createRandom({ seed: 1 }), regionAt: field.regionAt,
        });
        expect(devil.size).toBe(1);
        expect(devil.radius).toBe(DEVIL_RADIUS);
        devil.room = DEVIL_FULL_ROOM * 2;
        expect(devil.size).toBe(1);
        devil.room = 3;
        expect(devil.size).toBeLessThan(1);
        expect(devil.size).toBeGreaterThan(DEVIL_MIN_SIZE);
        expect(devil.radius).toBeCloseTo(DEVIL_RADIUS * devil.size);
        expect(devil.isStarving).toBe(false);
        devil.room = 1.2;
        expect(devil.isStarving).toBe(true);
        devil.room = 1;
        expect(devil.size).toBe(DEVIL_MIN_SIZE);
    });

    it('blows itself out, and is gone', () => {
        const field = createFieldModel({ rows: 20, cols: 30, obstacles: [] });
        const devil = createDustDevilModel({
            row: 10, col: 10, speed: 6, chase: 0, target: NO_TARGET, random: createRandom({ seed: 1 }), regionAt: field.regionAt,
        });
        devil.blowOut();
        expect(devil.phase).toBe('blowing-out');
        devil.update(DEVIL_BLOW_OUT_MS / 2);
        expect(devil.blowOutProgress).toBeCloseTo(0.5);
        devil.update(DEVIL_BLOW_OUT_MS / 2);
        expect(devil.phase).toBe('gone');
    });
});
