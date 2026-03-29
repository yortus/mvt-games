import type { GamePhase } from './common';
import { createBoardModel, type BoardModel } from './board-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface GameModel {
    readonly phase: GamePhase;
    readonly board: BoardModel;
    readonly score: number;
    /** Attempt to swap two cells. Returns true if accepted. */
    trySwap(r1: number, c1: number, r2: number, c2: number): boolean;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    readonly rows?: number;
    readonly cols?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameModel(options: GameModelOptions = {}): GameModel {
    const board = createBoardModel({ rows: options.rows, cols: options.cols });
    const gamePhase: GamePhase = 'playing';

    const model: GameModel = {
        get phase() { return gamePhase; },
        get board() { return board; },
        get score() { return board.score; },

        trySwap(r1: number, c1: number, r2: number, c2: number): boolean {
            if (gamePhase !== 'playing') return false;
            return board.trySwap(r1, c1, r2, c2);
        },

        update(deltaMs: number): void {
            if (gamePhase !== 'playing') return;
            board.update(deltaMs);
        },
    };

    return model;
}
