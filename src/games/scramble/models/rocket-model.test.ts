import { describe, it, expect } from 'vitest';
import { createRocketModel } from './rocket-model';

function makeRocket(detectRange = 8, launchSpeed = 8) {
    return createRocketModel({ detectRange, launchSpeed });
}

describe('RocketModel', () => {
    describe('initial state', () => {
        it('starts inactive', () => {
            const r = makeRocket();
            expect(r.active).toBe(false);
            expect(r.alive).toBe(false);
            expect(r.phase).toBe('idle');
        });
    });

    describe('activate', () => {
        it('sets position and idle phase', () => {
            const r = makeRocket();
            r.activate(20, 10);
            expect(r.active).toBe(true);
            expect(r.alive).toBe(true);
            expect(r.worldCol).toBe(20);
            expect(r.worldRow).toBe(10);
            expect(r.phase).toBe('idle');
        });
    });

    describe('detection', () => {
        it('remains idle if ship is outside detect range', () => {
            const r = makeRocket(8);
            r.activate(20, 10);
            r.update(100, 5); // ship at col 5, rocket at 20, dist = 15 > 8
            expect(r.phase).toBe('idle');
        });

        it('launches when ship enters detect range', () => {
            const r = makeRocket(8);
            r.activate(20, 10);
            r.update(100, 15); // dist = 5 < 8
            expect(r.phase).toBe('launching');
        });

        it('launches when ship is behind but within range', () => {
            const r = makeRocket(8);
            r.activate(20, 10);
            r.update(100, 25); // dist = -5, abs = 5 < 8
            expect(r.phase).toBe('launching');
        });
    });

    describe('launching phase', () => {
        it('moves upward at launch speed', () => {
            const r = makeRocket(8, 8);
            r.activate(20, 10);
            r.update(16, 18); // trigger launch
            expect(r.phase).toBe('launching');
            const initialRow = r.worldRow;
            r.update(500, 18); // 0.5s at speed 8 = 4 tiles up
            expect(r.worldRow).toBeLessThan(initialRow);
        });

        it('transitions to flying when passing row 0', () => {
            const r = makeRocket(8, 8);
            r.activate(20, 2);
            r.update(16, 18); // trigger launch, advancing slightly
            // At speed 8 tiles/s, need 2/8 = 0.25s to reach row 0
            r.update(300, 18); // worldRow ~ 2 - 8*0.316 = -0.528 -> transitions to flying
            expect(r.phase).toBe('flying');
        });
    });

    describe('kill / deactivate', () => {
        it('kill clears alive and active', () => {
            const r = makeRocket();
            r.activate(20, 10);
            r.kill();
            expect(r.alive).toBe(false);
            expect(r.active).toBe(false);
        });

        it('deactivate clears both and resets phase', () => {
            const r = makeRocket();
            r.activate(20, 10);
            r.update(16, 18); // trigger launch
            r.deactivate();
            expect(r.active).toBe(false);
            expect(r.alive).toBe(false);
            expect(r.phase).toBe('idle');
        });

        it('does not update after kill', () => {
            const r = makeRocket(8, 8);
            r.activate(20, 10);
            r.kill();
            const row = r.worldRow;
            r.update(1000, 18);
            expect(r.worldRow).toBe(row);
        });
    });
});
