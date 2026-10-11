import { describe, expect, it } from 'vitest';
import { createBeetleModel } from './beetle-model';
import { createFieldModel } from './field-model';
import { BEETLE_HATCH_MS } from './model-constants';

const STEP_MS = 1000 / 60;

describe('BeetleModel', () => {
    it('crawls right round the edge of the meadow, turning at the corners', () => {
        const field = createFieldModel({ rows: 4, cols: 6, obstacles: [] });
        const beetle = createBeetleModel({
            row: 0, col: 3, direction: 'right', hand: 'right', speed: 10, isWalkable: field.isWalkable, isHatching: false,
        });
        // Three steps along the top, then down the right edge
        for (let elapsed = 0; elapsed < 500; elapsed += STEP_MS) beetle.update(STEP_MS);
        expect(beetle.col).toBeCloseTo(6);
        expect(beetle.row).toBeGreaterThan(1);
        expect(beetle.direction).toBe('down');
    });

    it('keeps to the fences round the meadow, never into pasture', () => {
        const field = createFieldModel({ rows: 4, cols: 6, obstacles: [] });
        // Fence off the left half
        field.addFence([0, 1, 2, 3, 4], [3, 3, 3, 3, 3], 5);
        const kept = field.regionAt(0, 5);
        field.claimRegions((region) => region === kept);
        const beetle = createBeetleModel({
            row: 0, col: 4, direction: 'left', hand: 'left', speed: 10, isWalkable: field.isWalkable, isHatching: false,
        });
        for (let elapsed = 0; elapsed < 3000; elapsed += STEP_MS) {
            beetle.update(STEP_MS);
            expect(beetle.col).toBeGreaterThanOrEqual(3);
        }
    });

    it('waits, harmless, while it hatches', () => {
        const field = createFieldModel({ rows: 4, cols: 6, obstacles: [] });
        const beetle = createBeetleModel({
            row: 0, col: 3, direction: 'right', hand: 'right', speed: 10, isWalkable: field.isWalkable, isHatching: true,
        });
        beetle.update(BEETLE_HATCH_MS / 2);
        expect(beetle.phase).toBe('hatching');
        expect(beetle.hatchProgress).toBeCloseTo(0.5);
        expect(beetle.col).toBe(3);
        beetle.update(BEETLE_HATCH_MS / 2);
        expect(beetle.phase).toBe('crawling');
    });
});
