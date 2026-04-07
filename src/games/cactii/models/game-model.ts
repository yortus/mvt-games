import type { CactusCell, GamePhase } from './common';
import { createBoardModel, type BoardModel } from './board-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface GameModel {
    readonly phase: GamePhase;
    readonly board: BoardModel;
    readonly score: number;
    /** Monotonic clock accumulated from update(deltaMs). */
    readonly clockMs: number;
    /** Attempt to swap two cells. Returns true if accepted. */
    trySwap(cell1: CactusCell, cell2: CactusCell): boolean;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    readonly rowCount?: number;
    readonly colCount?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameModel(options: GameModelOptions = {}): GameModel {
    const board = createBoardModel(options);
    const gamePhase: GamePhase = 'playing';
    let clockMs = 0;

    const model: GameModel = {
        get phase() { return gamePhase; },
        get board() { return board; },
        get score() { return board.score; },
        get clockMs() { return clockMs; },

        trySwap(cell1: CactusCell, cell2: CactusCell): boolean {
            if (gamePhase !== 'playing') return false;
            return board.trySwap(cell1, cell2);
        },

        update(deltaMs: number): void {
            if (gamePhase !== 'playing') return;
            clockMs += deltaMs;
            board.update(deltaMs);
        },
    };

    return model;
}
