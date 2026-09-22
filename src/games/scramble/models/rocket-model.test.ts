import { describe, it, expect } from 'vitest';
import { createRocketModel } from './rocket-model';

function makeRocket(worldCol = 20, worldRow = 10, detectRange = 8, launchSpeed = 8) {
    return createRocketModel({ worldCol, worldRow, detectRange, launchSpeed });
}

describe('RocketModel', () => {
    describe('initial state', () => {
        it('starts idle at given position', () => {
            const r = makeRocket(20, 10);
            expect(r.worldCol).toBe(20);
            expect(r.worldRow).toBe(10);
            expect(r.phase).toBe('idle');
        });
    });

    describe('detection', () => {
        it('remains idle if ship is outside detect range', () => {
            const r = makeRocket(20, 10, 8);
            r.update(100, 5); // ship at col 5, rocket at 20, dist = 15 > 8
            expect(r.phase).toBe('idle');
        });

        it('launches when ship enters detect range', () => {
            const r = makeRocket(20, 10, 8);
            r.update(100, 15); // dist = 5 < 8
            expect(r.phase).toBe('launching');
        });

        it('launches when ship is behind but within range', () => {
            const r = makeRocket(20, 10, 8);
            r.update(100, 25); // dist = -5, abs = 5 < 8
            expect(r.phase).toBe('launching');
        });
    });

    describe('launching phase', () => {
        it('moves upward at launch speed', () => {
            const r = makeRocket(20, 10, 8, 8);
            r.update(16, 18); // trigger launch
            expect(r.phase).toBe('launching');
            const initialRow = r.worldRow;
            r.update(500, 18); // 0.5s at speed 8 = 4 tiles up
            expect(r.worldRow).toBeLessThan(initialRow);
        });

        it('transitions to flying when passing row 0', () => {
            const r = makeRocket(20, 2, 8, 8);
            r.update(16, 18); // trigger launch, advancing slightly
            // At speed 8 tiles/s, need 2/8 = 0.25s to reach row 0
            r.update(300, 18); // worldRow ~ 2 - 8*0.316 = -0.528 -> transitions to flying
            expect(r.phase).toBe('flying');
        });
    });

    describe('flying phase', () => {
        it('keeps climbing', () => {
            const r = makeRocket(20, 2, 8, 8);
            r.update(16, 18);
            r.update(300, 18);
            const row = r.worldRow;
            r.update(500, 18);
            expect(r.worldRow).toBeLessThan(row);
        });
    });
});
