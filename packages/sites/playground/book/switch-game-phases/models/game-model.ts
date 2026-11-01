// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long a round lasts, in ms. */
const ROUND_MS = 10000;
/** How long the score shows after a round, before the title comes back, in ms. */
const GAME_OVER_MS = 3000;
/** How far along its path a hit knocks the target, in seconds of its movement. */
const JUMP_ON_HIT = 2.1;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Which part of the game is on: the title, a round, or the end of one. */
export type GamePhase = 'title' | 'playing' | 'game-over';

/**
 * A game of target practice. From the title, the player starts a round, and
 * has a few seconds to hit a moving target as often as they can. The game
 * then shows the score for a while, and goes back to the title. Positions
 * are in world units, from the play area's top left corner.
 */
export interface GameModel {
    readonly phase: GamePhase;
    /** How many times the target was hit this round. */
    readonly score: number;
    /** How much of the round is left, from 1 at the start to 0 at the end. */
    readonly timeLeft: number;
    readonly targetX: number;
    readonly targetY: number;
    /** Starts a round, from the title. */
    readonly startGame: () => void;
    /** Scores a hit on the target, which then jumps along its path. */
    readonly hitTarget: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    /** The width of the play area, in world units. */
    readonly width: number;
    /** The height of the play area, in world units. */
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a game on its title. */
export function createGameModel({ width, height }: GameModelOptions): GameModel {
    let phase: GamePhase = 'title';
    let score = 0;
    // How long the game has been in this phase, in ms
    let phaseMs = 0;
    // How far along its path the target has been knocked by hits
    let pathOffset = 0;
    let targetX = 0;
    let targetY = 0;
    moveTarget();

    const model: GameModel = {
        get phase() { return phase; },
        get score() { return score; },
        get timeLeft() { return phase === 'playing' ? 1 - phaseMs / ROUND_MS : 0; },
        get targetX() { return targetX; },
        get targetY() { return targetY; },

        startGame() {
            if (phase !== 'title') return;
            enterPhase('playing');
            score = 0;
            pathOffset = 0;
            moveTarget();
        },

        hitTarget() {
            if (phase !== 'playing') return;
            score++;
            pathOffset += JUMP_ON_HIT;
            moveTarget();
        },

        update(deltaMs) {
            phaseMs += deltaMs;
            if (phase === 'playing') {
                moveTarget();
                if (phaseMs >= ROUND_MS) enterPhase('game-over');
            }
            else if (phase === 'game-over' && phaseMs >= GAME_OVER_MS) {
                enterPhase('title');
            }
        },
    };

    return model;

    function enterPhase(newPhase: GamePhase): void {
        phase = newPhase;
        phaseMs = 0;
    }

    // A looping path round the play area, which the target follows during a round
    function moveTarget(): void {
        const t = phaseMs / 1000 + pathOffset;
        targetX = width / 2 + Math.sin(t * 1.3) * width * 0.36;
        targetY = height / 2 + Math.sin(t * 1.9) * height * 0.3;
    }
}
