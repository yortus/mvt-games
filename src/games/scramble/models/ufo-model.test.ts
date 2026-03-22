import { describe, it, expect } from 'vitest';
import { createUfoModel } from './ufo-model';

function makeUfo(speed = 4, oscillationAmp = 1.5, oscillationFreq = 2) {
    return createUfoModel({ speed, oscillationAmp, oscillationFreq });
}

describe('UfoModel', () => {
    describe('initial state', () => {
        it('starts inactive', () => {
            const u = makeUfo();
            expect(u.isActive).toBe(false);
            expect(u.isAlive).toBe(false);
        });
    });

    describe('activate', () => {
        it('sets position and active state', () => {
            const u = makeUfo();
            u.activate(30, 5);
            expect(u.isActive).toBe(true);
            expect(u.isAlive).toBe(true);
            expect(u.worldCol).toBe(30);
            // worldRow starts at baseRow since sin(0) = 0
            expect(u.worldRow).toBeCloseTo(5, 1);
        });
    });

    describe('update - movement', () => {
        it('moves leftward at given speed', () => {
            const u = makeUfo(4, 0, 0);
            u.activate(30, 5);
            u.update(1000); // 1 second at speed 4
            expect(u.worldCol).toBeCloseTo(26, 1);
        });

        it('does not move when inactive', () => {
            const u = makeUfo();
            u.update(1000);
            expect(u.worldCol).toBe(0);
        });
    });

    describe('update - oscillation', () => {
        it('worldRow oscillates around base row', () => {
            const u = makeUfo(0, 2, 1); // amp=2, freq=1Hz, no horizontal movement
            u.activate(30, 5);

            // At t=0.25s (quarter period), sin(pi/2) = 1, so worldRow = 5 + 2 = 7
            u.update(250);
            expect(u.worldRow).toBeCloseTo(7, 0);

            // At t=0.5s (half period), sin(pi) = 0, so worldRow = 5
            u.update(250);
            expect(u.worldRow).toBeCloseTo(5, 0);
        });
    });

    describe('kill / deactivate', () => {
        it('kill clears alive and active', () => {
            const u = makeUfo();
            u.activate(30, 5);
            u.kill();
            expect(u.isAlive).toBe(false);
            expect(u.isActive).toBe(false);
        });

        it('deactivate clears alive and active', () => {
            const u = makeUfo();
            u.activate(30, 5);
            u.deactivate();
            expect(u.isAlive).toBe(false);
            expect(u.isActive).toBe(false);
        });

        it('does not update after kill', () => {
            const u = makeUfo(4);
            u.activate(30, 5);
            u.kill();
            const col = u.worldCol;
            u.update(1000);
            expect(u.worldCol).toBe(col);
        });
    });
});
