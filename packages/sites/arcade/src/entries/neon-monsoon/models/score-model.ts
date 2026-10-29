import { CHAIN_WINDOW_MS, EXTEND_SCORES, MAX_CHAIN_MULTIPLIER } from './model-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The score and everything that feeds it: the chain of quick kills, the
 * session's high score, and the extra lives that passing certain scores
 * earns. The game model decides what scores; this keeps the arithmetic.
 */
export interface ScoreModel {
    readonly score: number;
    /** The best score this session; kept across new games. */
    readonly highScore: number;
    /** Kills in quick succession; 0 when no chain is running. */
    readonly chain: number;
    /** The time left to extend the chain, from 1 down to 0. */
    readonly chainFraction: number;
    /**
     * Extra lives earned by passing `EXTEND_SCORES` this game. Only ever goes
     * up; the game model gives a life each time it does.
     */
    readonly extendsEarned: number;
    /** A kill worth `points`, multiplied by the chain it extends. */
    addKill: (points: number) => void;
    /** Add points as they are, not multiplied by the chain: gems, bonuses, spare items. */
    addPoints: (points: number) => void;
    /** End the chain, as when the ship is destroyed. */
    breakChain: () => void;
    /** Back to zero for a new game. The high score is kept. */
    reset: () => void;
    /**
     * Start a game again from a saved score, with no chain running. The
     * extra lives that the score has passed count as earned. The high score
     * is kept, and rises to the score if it is lower.
     */
    restore: (saved: { readonly score: number }) => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createScoreModel(): ScoreModel {
    let score = 0;
    let highScore = 0;
    let chain = 0;
    let chainMsLeft = 0;
    let extendsEarned = 0;

    const model: ScoreModel = {
        get score() {
            return score;
        },
        get highScore() {
            return highScore;
        },
        get chain() {
            return chain;
        },
        get chainFraction() {
            return chainMsLeft / CHAIN_WINDOW_MS;
        },
        get extendsEarned() {
            return extendsEarned;
        },

        addKill(points) {
            chain = chainMsLeft > 0 ? chain + 1 : 1;
            chainMsLeft = CHAIN_WINDOW_MS;
            addPoints(points * Math.min(chain, MAX_CHAIN_MULTIPLIER));
        },

        addPoints,

        breakChain() {
            chain = 0;
            chainMsLeft = 0;
        },

        reset() {
            score = 0;
            extendsEarned = 0;
            model.breakChain();
        },

        restore(saved) {
            model.reset();
            addPoints(saved.score);
        },

        update(deltaMs) {
            chainMsLeft = Math.max(0, chainMsLeft - deltaMs);
            if (chainMsLeft === 0) chain = 0;
        },
    };

    return model;

    function addPoints(points: number): void {
        score += points;
        if (score > highScore) highScore = score;
        while (extendsEarned < EXTEND_SCORES.length && score >= EXTEND_SCORES[extendsEarned]) extendsEarned++;
    }
}
