import { describe, expect, it } from 'vitest';
import { CHAIN_WINDOW_MS, EXTEND_SCORES, GRAZE_POINTS, MAX_CHAIN_MULTIPLIER } from './model-constants';
import { createScoreModel } from './score-model';

describe('ScoreModel', () => {
    it('multiplies each kill by the chain it extends', () => {
        const scoring = createScoreModel();
        scoring.addKill(10);
        scoring.update(CHAIN_WINDOW_MS / 2);
        scoring.addKill(10);
        expect(scoring.chain).toBe(2);
        expect(scoring.score).toBe(10 + 20);
    });

    it('ends the chain when its window runs out', () => {
        const scoring = createScoreModel();
        scoring.addKill(10);
        scoring.update(CHAIN_WINDOW_MS);
        expect(scoring.chain).toBe(0);
        expect(scoring.chainFraction).toBe(0);
        scoring.addKill(10);
        expect(scoring.chain).toBe(1);
    });

    it('caps the multiplier', () => {
        const scoring = createScoreModel();
        for (let i = 0; i < MAX_CHAIN_MULTIPLIER + 5; i++) scoring.addKill(1);
        const before = scoring.score;
        scoring.addKill(1);
        expect(scoring.score - before).toBe(MAX_CHAIN_MULTIPLIER);
    });

    it('counts grazes', () => {
        const scoring = createScoreModel();
        scoring.addGrazes(3);
        expect(scoring.grazeCount).toBe(3);
        expect(scoring.score).toBe(3 * GRAZE_POINTS);
    });

    it('earns an extra life at each extend score, once', () => {
        const scoring = createScoreModel();
        scoring.addPoints(EXTEND_SCORES[0] - 1);
        expect(scoring.extendsEarned).toBe(0);
        scoring.addPoints(1);
        expect(scoring.extendsEarned).toBe(1);
        scoring.addPoints(1);
        expect(scoring.extendsEarned).toBe(1);
    });

    it('keeps the high score across a reset', () => {
        const scoring = createScoreModel();
        scoring.addPoints(500);
        scoring.reset();
        expect(scoring.score).toBe(0);
        expect(scoring.highScore).toBe(500);
        expect(scoring.extendsEarned).toBe(0);
    });
});
