import { describe, expect, it } from 'vitest';
import { CELEBRATION_OPENER_MS, CELEBRATION_STEP_MS } from '../data';
import { type CelebrationModel, createCelebrationModel } from './celebration-model';
import type { WayWin } from './evaluate-ways';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WINS: readonly WayWin[] = [
    { symbol: 'pic1', rows: [0, 0, 0, 0], payout: 40 },
    { symbol: 'pic4', rows: [2, 1, 0], payout: 11 },
];

function advance(celebration: CelebrationModel, totalMs: number): void {
    const frameMs = 10;
    for (let elapsed = 0; elapsed < totalMs; elapsed += frameMs) celebration.update(frameMs);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('celebration model', () => {
    it('starts inactive', () => {
        const celebration = createCelebrationModel();

        expect(celebration.isActive).toBe(false);
        expect(celebration.stepIndex).toBe(-1);
        expect(celebration.win).toBeUndefined();
        expect(celebration.wins).toEqual([]);
    });

    it('opens with every win at once', () => {
        const celebration = createCelebrationModel();

        celebration.start(WINS);

        expect(celebration.isActive).toBe(true);
        expect(celebration.stepIndex).toBe(0);
        expect(celebration.stepKind).toBe('allWins');
        expect(celebration.win).toBeUndefined();
        expect(celebration.wins).toBe(WINS);
    });

    it('then shows each win in turn, once, and ends', () => {
        const celebration = createCelebrationModel();
        celebration.start(WINS);

        advance(celebration, CELEBRATION_OPENER_MS);
        expect(celebration.stepIndex).toBe(1);
        expect(celebration.stepKind).toBe('oneWin');
        expect(celebration.win).toBe(WINS[0]);

        advance(celebration, CELEBRATION_STEP_MS);
        expect(celebration.stepIndex).toBe(2);
        expect(celebration.win).toBe(WINS[1]);

        advance(celebration, CELEBRATION_STEP_MS);
        expect(celebration.isActive).toBe(false);
        expect(celebration.stepIndex).toBe(-1);
    });

    it('rises steadily through each step', () => {
        const celebration = createCelebrationModel();
        celebration.start(WINS);

        advance(celebration, 300);
        expect(celebration.progress).toBeCloseTo(300 / CELEBRATION_OPENER_MS);

        advance(celebration, CELEBRATION_OPENER_MS - 300 + CELEBRATION_STEP_MS / 2);
        expect(celebration.progress).toBeCloseTo(0.5);
    });

    it('skips the steps a large update covers', () => {
        const celebration = createCelebrationModel();
        celebration.start(WINS);

        celebration.update(CELEBRATION_OPENER_MS + CELEBRATION_STEP_MS + 100);

        expect(celebration.stepIndex).toBe(2);
        expect(celebration.progress).toBeCloseTo(100 / CELEBRATION_STEP_MS);
    });

    it('can be stopped at once', () => {
        const celebration = createCelebrationModel();
        celebration.start(WINS);
        advance(celebration, CELEBRATION_OPENER_MS);

        celebration.stop();

        expect(celebration.isActive).toBe(false);
        expect(celebration.win).toBeUndefined();
    });

    it('has nothing to celebrate without wins', () => {
        const celebration = createCelebrationModel();

        celebration.start([]);

        expect(celebration.isActive).toBe(false);
    });
});
