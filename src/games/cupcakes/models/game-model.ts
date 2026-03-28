import type { GamePhase } from './common';
import { createBoardModel, type BoardModel } from './board-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface GameModel {
    readonly phase: GamePhase;
    readonly board: BoardModel;
    readonly score: number;
    selectCell(row: number, col: number): void;
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

        selectCell(row: number, col: number): void {
            if (gamePhase !== 'playing') return;
            board.selectCell(row, col);
        },

        update(deltaMs: number): void {
            if (gamePhase !== 'playing') return;
            board.update(deltaMs);
        },
    };

    return model;
}
