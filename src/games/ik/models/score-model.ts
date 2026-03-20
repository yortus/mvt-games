import { POINTS_TO_WIN_ROUND, ROUNDS_TO_WIN_MATCH } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ScoreModel {
    readonly playerPoints: number;
    readonly opponentPoints: number;
    readonly playerRounds: number;
    readonly opponentRounds: number;
    readonly round: number;
    scorePoint(scorer: 'player' | 'opponent'): void;
    isRoundOver(): boolean;
    isMatchOver(): boolean;
    getRoundWinner(): 'player' | 'opponent' | undefined;
    getMatchWinner(): 'player' | 'opponent' | undefined;
    nextRound(): void;
    reset(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createScoreModel(): ScoreModel {
    let playerPoints = 0;
    let opponentPoints = 0;
    let playerRounds = 0;
    let opponentRounds = 0;
    let round = 1;

    const model: ScoreModel = {
        get playerPoints() {
            return playerPoints;
        },
        get opponentPoints() {
            return opponentPoints;
        },
        get playerRounds() {
            return playerRounds;
        },
        get opponentRounds() {
            return opponentRounds;
        },
        get round() {
            return round;
        },

        scorePoint(scorer: 'player' | 'opponent'): void {
            if (scorer === 'player') {
                playerPoints++;
            }
            else {
                opponentPoints++;
            }
        },

        isRoundOver(): boolean {
            return playerPoints >= POINTS_TO_WIN_ROUND || opponentPoints >= POINTS_TO_WIN_ROUND;
        },

        isMatchOver(): boolean {
            return playerRounds >= ROUNDS_TO_WIN_MATCH || opponentRounds >= ROUNDS_TO_WIN_MATCH;
        },

        getRoundWinner(): 'player' | 'opponent' | undefined {
            if (playerPoints >= POINTS_TO_WIN_ROUND) return 'player';
            if (opponentPoints >= POINTS_TO_WIN_ROUND) return 'opponent';
            return undefined;
        },

        getMatchWinner(): 'player' | 'opponent' | undefined {
            if (playerRounds >= ROUNDS_TO_WIN_MATCH) return 'player';
            if (opponentRounds >= ROUNDS_TO_WIN_MATCH) return 'opponent';
            return undefined;
        },

        nextRound(): void {
            const winner = model.getRoundWinner();
            if (winner === 'player') {
                playerRounds++;
            }
            else if (winner === 'opponent') {
                opponentRounds++;
            }
            playerPoints = 0;
            opponentPoints = 0;
            round++;
        },

        reset(): void {
            playerPoints = 0;
            opponentPoints = 0;
            playerRounds = 0;
            opponentRounds = 0;
            round = 1;
        },
    };

    return model;
}
