import { describe, it, expect } from 'vitest';
import { createMatchModel } from './match-model';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MatchModel', () => {
    describe('initial state', () => {
        it('starts with zero points, zero rounds, round 1', () => {
            const match = createMatchModel();
            expect(match.playerPoints).toBe(0);
            expect(match.opponentPoints).toBe(0);
            expect(match.playerRounds).toBe(0);
            expect(match.opponentRounds).toBe(0);
            expect(match.round).toBe(1);
        });

        it('is not round-over or match-over initially', () => {
            const match = createMatchModel();
            expect(match.isRoundOver()).toBe(false);
            expect(match.isMatchOver()).toBe(false);
            expect(match.getRoundWinner()).toBeUndefined();
            expect(match.getMatchWinner()).toBeUndefined();
        });
    });

    describe('scoring points', () => {
        it('increments player points', () => {
            const match = createMatchModel();
            match.scorePoint('player');
            expect(match.playerPoints).toBe(1);
            expect(match.opponentPoints).toBe(0);
        });

        it('increments opponent points', () => {
            const match = createMatchModel();
            match.scorePoint('opponent');
            expect(match.opponentPoints).toBe(1);
            expect(match.playerPoints).toBe(0);
        });

        it('tracks both sides independently', () => {
            const match = createMatchModel();
            match.scorePoint('player');
            match.scorePoint('player');
            match.scorePoint('opponent');
            expect(match.playerPoints).toBe(2);
            expect(match.opponentPoints).toBe(1);
        });
    });

    describe('round win conditions', () => {
        it('round is over when player reaches 3 points', () => {
            const match = createMatchModel();
            match.scorePoint('player');
            match.scorePoint('player');
            expect(match.isRoundOver()).toBe(false);
            match.scorePoint('player');
            expect(match.isRoundOver()).toBe(true);
            expect(match.getRoundWinner()).toBe('player');
        });

        it('round is over when opponent reaches 3 points', () => {
            const match = createMatchModel();
            match.scorePoint('opponent');
            match.scorePoint('opponent');
            match.scorePoint('opponent');
            expect(match.isRoundOver()).toBe(true);
            expect(match.getRoundWinner()).toBe('opponent');
        });
    });

    describe('nextRound', () => {
        it('awards a round to the winner and resets points', () => {
            const match = createMatchModel();
            match.scorePoint('player');
            match.scorePoint('player');
            match.scorePoint('player');
            match.nextRound();
            expect(match.playerRounds).toBe(1);
            expect(match.opponentRounds).toBe(0);
            expect(match.playerPoints).toBe(0);
            expect(match.opponentPoints).toBe(0);
            expect(match.round).toBe(2);
        });

        it('increments opponent rounds when opponent wins', () => {
            const match = createMatchModel();
            match.scorePoint('opponent');
            match.scorePoint('opponent');
            match.scorePoint('opponent');
            match.nextRound();
            expect(match.opponentRounds).toBe(1);
            expect(match.playerRounds).toBe(0);
            expect(match.round).toBe(2);
        });

        it('awards no round point on a draw', () => {
            const match = createMatchModel();
            match.scorePoint('player');
            match.scorePoint('opponent');
            // Neither reached 3 - no round winner
            match.nextRound();
            expect(match.playerRounds).toBe(0);
            expect(match.opponentRounds).toBe(0);
            expect(match.round).toBe(2);
        });
    });

    describe('match win conditions', () => {
        it('match is over when player wins 2 rounds', () => {
            const match = createMatchModel();
            // Win round 1
            match.scorePoint('player');
            match.scorePoint('player');
            match.scorePoint('player');
            match.nextRound();
            expect(match.isMatchOver()).toBe(false);
            // Win round 2
            match.scorePoint('player');
            match.scorePoint('player');
            match.scorePoint('player');
            match.nextRound();
            expect(match.isMatchOver()).toBe(true);
            expect(match.getMatchWinner()).toBe('player');
        });

        it('match is over when opponent wins 2 rounds', () => {
            const match = createMatchModel();
            // Win round 1
            match.scorePoint('opponent');
            match.scorePoint('opponent');
            match.scorePoint('opponent');
            match.nextRound();
            // Win round 2
            match.scorePoint('opponent');
            match.scorePoint('opponent');
            match.scorePoint('opponent');
            match.nextRound();
            expect(match.isMatchOver()).toBe(true);
            expect(match.getMatchWinner()).toBe('opponent');
        });
    });

    describe('reset', () => {
        it('resets all state to initial values', () => {
            const match = createMatchModel();
            match.scorePoint('player');
            match.scorePoint('player');
            match.scorePoint('player');
            match.nextRound();
            match.scorePoint('opponent');
            match.reset();
            expect(match.playerPoints).toBe(0);
            expect(match.opponentPoints).toBe(0);
            expect(match.playerRounds).toBe(0);
            expect(match.opponentRounds).toBe(0);
            expect(match.round).toBe(1);
        });
    });
});
