import { describe, it, expect } from 'vitest';
import { createScoreModel } from './score-model';

function makeScore(initialLives = 3, fuelDepletionRate = 0.03) {
    return createScoreModel({ initialLives, fuelDepletionRate });
}

describe('ScoreModel', () => {
    describe('initial state', () => {
        it('starts with zero score, full fuel, given lives', () => {
            const s = makeScore(3);
            expect(s.score).toBe(0);
            expect(s.lives).toBe(3);
            expect(s.fuel).toBe(1.0);
            expect(s.fuelEmpty).toBe(false);
            expect(s.sectionIndex).toBe(0);
            expect(s.loop).toBe(0);
        });
    });

    describe('addPoints', () => {
        it('accumulates score', () => {
            const s = makeScore();
            s.addPoints(50);
            s.addPoints(100);
            expect(s.score).toBe(150);
        });
    });

    describe('loseLife', () => {
        it('decrements lives and returns true when lives remain', () => {
            const s = makeScore(3);
            expect(s.loseLife()).toBe(true);
            expect(s.lives).toBe(2);
        });

        it('returns false when no lives remain', () => {
            const s = makeScore(1);
            s.loseLife(); // lives -> 0
            expect(s.loseLife()).toBe(false);
        });
    });

    describe('fuel', () => {
        it('depletes over time', () => {
            const s = makeScore(3, 1.0); // 1.0 per second for fast test
            s.update(500); // 0.5 second
            expect(s.fuel).toBeCloseTo(0.5, 1);
        });

        it('sets fuelEmpty when fuel reaches zero', () => {
            const s = makeScore(3, 10); // very fast depletion
            s.update(1000);
            expect(s.fuel).toBe(0);
            expect(s.fuelEmpty).toBe(true);
        });

        it('does not deplete further once empty', () => {
            const s = makeScore(3, 10);
            s.update(1000);
            expect(s.fuelEmpty).toBe(true);
            s.update(1000);
            expect(s.fuel).toBe(0);
        });

        it('addFuel increases fuel capped at 1.0', () => {
            const s = makeScore(3, 1.0);
            s.update(500); // fuel ~0.5
            s.addFuel(0.25);
            expect(s.fuel).toBeCloseTo(0.75, 1);
        });

        it('addFuel caps at 1.0', () => {
            const s = makeScore();
            s.addFuel(0.5); // already at 1.0
            expect(s.fuel).toBe(1.0);
        });
    });

    describe('section and loop', () => {
        it('tracks section index', () => {
            const s = makeScore();
            s.setSectionIndex(2);
            expect(s.sectionIndex).toBe(2);
        });

        it('advances loop count', () => {
            const s = makeScore();
            s.advanceLoop();
            expect(s.loop).toBe(1);
            s.advanceLoop();
            expect(s.loop).toBe(2);
        });
    });

    describe('reset', () => {
        it('restores all to initial values', () => {
            const s = makeScore(3, 0.03);
            s.addPoints(500);
            s.loseLife();
            s.setSectionIndex(2);
            s.advanceLoop();
            s.update(5000); // deplete fuel
            s.reset();
            expect(s.score).toBe(0);
            expect(s.lives).toBe(3);
            expect(s.fuel).toBe(1.0);
            expect(s.fuelEmpty).toBe(false);
            expect(s.sectionIndex).toBe(0);
            expect(s.loop).toBe(0);
        });
    });
});
