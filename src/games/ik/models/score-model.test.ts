import { describe, it, expect } from 'vitest';
import { createScoreModel } from './score-model';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScoreModel', () => {
    describe('initial state', () => {
        it('starts with zero points, zero rounds, round 1', () => {
            const score = createScoreModel();
            expect(score.playerPoints).toBe(0);
            expect(score.opponentPoints).toBe(0);
            expect(score.playerRounds).toBe(0);
            expect(score.opponentRounds).toBe(0);
            expect(score.round).toBe(1);
        });

        it('is not round-over or match-over initially', () => {
            const score = createScoreModel();
            expect(score.isRoundOver()).toBe(false);
            expect(score.isMatchOver()).toBe(false);
            expect(score.getRoundWinner()).toBeUndefined();
            expect(score.getMatchWinner()).toBeUndefined();
        });
    });

    describe('scoring points', () => {
        it('increments player points', () => {
            const score = createScoreModel();
            score.scorePoint('player');
            expect(score.playerPoints).toBe(1);
            expect(score.opponentPoints).toBe(0);
        });

        it('increments opponent points', () => {
            const score = createScoreModel();
            score.scorePoint('opponent');
            expect(score.opponentPoints).toBe(1);
            expect(score.playerPoints).toBe(0);
        });

        it('tracks both sides independently', () => {
            const score = createScoreModel();
            score.scorePoint('player');
            score.scorePoint('player');
            score.scorePoint('opponent');
            expect(score.playerPoints).toBe(2);
            expect(score.opponentPoints).toBe(1);
        });
    });

    describe('round win conditions', () => {
        it('round is over when player reaches 3 points', () => {
            const score = createScoreModel();
            score.scorePoint('player');
            score.scorePoint('player');
            expect(score.isRoundOver()).toBe(false);
            score.scorePoint('player');
            expect(score.isRoundOver()).toBe(true);
            expect(score.getRoundWinner()).toBe('player');
        });

        it('round is over when opponent reaches 3 points', () => {
            const score = createScoreModel();
            score.scorePoint('opponent');
            score.scorePoint('opponent');
            score.scorePoint('opponent');
            expect(score.isRoundOver()).toBe(true);
            expect(score.getRoundWinner()).toBe('opponent');
        });
    });

    describe('nextRound', () => {
        it('awards a round to the winner and resets points', () => {
            const score = createScoreModel();
            score.scorePoint('player');
            score.scorePoint('player');
            score.scorePoint('player');
            score.nextRound();
            expect(score.playerRounds).toBe(1);
            expect(score.opponentRounds).toBe(0);
            expect(score.playerPoints).toBe(0);
            expect(score.opponentPoints).toBe(0);
            expect(score.round).toBe(2);
        });

        it('increments opponent rounds when opponent wins', () => {
            const score = createScoreModel();
            score.scorePoint('opponent');
            score.scorePoint('opponent');
            score.scorePoint('opponent');
            score.nextRound();
            expect(score.opponentRounds).toBe(1);
            expect(score.playerRounds).toBe(0);
            expect(score.round).toBe(2);
        });

        it('awards no round point on a draw', () => {
            const score = createScoreModel();
            score.scorePoint('player');
            score.scorePoint('opponent');
            // Neither reached 3 - no round winner
            score.nextRound();
            expect(score.playerRounds).toBe(0);
            expect(score.opponentRounds).toBe(0);
            expect(score.round).toBe(2);
        });
    });

    describe('match win conditions', () => {
        it('match is over when player wins 2 rounds', () => {
            const score = createScoreModel();
            // Win round 1
            score.scorePoint('player');
            score.scorePoint('player');
            score.scorePoint('player');
            score.nextRound();
            expect(score.isMatchOver()).toBe(false);
            // Win round 2
            score.scorePoint('player');
            score.scorePoint('player');
            score.scorePoint('player');
            score.nextRound();
            expect(score.isMatchOver()).toBe(true);
            expect(score.getMatchWinner()).toBe('player');
        });

        it('match is over when opponent wins 2 rounds', () => {
            const score = createScoreModel();
            // Win round 1
            score.scorePoint('opponent');
            score.scorePoint('opponent');
            score.scorePoint('opponent');
            score.nextRound();
            // Win round 2
            score.scorePoint('opponent');
            score.scorePoint('opponent');
            score.scorePoint('opponent');
            score.nextRound();
            expect(score.isMatchOver()).toBe(true);
            expect(score.getMatchWinner()).toBe('opponent');
        });
    });

    describe('reset', () => {
        it('resets all state to initial values', () => {
            const score = createScoreModel();
            score.scorePoint('player');
            score.scorePoint('player');
            score.scorePoint('player');
            score.nextRound();
            score.scorePoint('opponent');
            score.reset();
            expect(score.playerPoints).toBe(0);
            expect(score.opponentPoints).toBe(0);
            expect(score.playerRounds).toBe(0);
            expect(score.opponentRounds).toBe(0);
            expect(score.round).toBe(1);
        });
    });
});
