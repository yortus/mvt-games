import type { CactusCell, GamePhase } from './common';
import { createBoardModel, type BoardModel } from './board-model';
import { watch } from '#common';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface CactiiPlayerInput {
    restartPressed: boolean;
}

export function createCactiiPlayerInput(): CactiiPlayerInput {
    return { restartPressed: false };
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface GameModel {
    readonly phase: GamePhase;
    readonly board: BoardModel;
    readonly score: number;
    /** Monotonic clock accumulated from update(deltaMs). */
    readonly clockMs: number;
    readonly playerInput: CactiiPlayerInput;
    /** Attempt to swap two cells. Returns true if accepted. */
    trySwap(cell1: CactusCell, cell2: CactusCell): boolean;
    /** Reset the game to initial state. */
    reset(): void;
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
    let board = createBoardModel(options);
    let gamePhase: GamePhase = 'playing';
    let clockMs = 0;

    const playerInput = createCactiiPlayerInput();
    const watcher = watch({ restart: () => playerInput.restartPressed });

    const model: GameModel = {
        get phase() { return gamePhase; },
        get board() { return board; },
        get score() { return board.score; },
        get clockMs() { return clockMs; },
        get playerInput() { return playerInput; },

        trySwap(cell1: CactusCell, cell2: CactusCell): boolean {
            if (gamePhase !== 'playing') return false;
            return board.trySwap(cell1, cell2);
        },

        reset(): void {
            board = createBoardModel(options);
            clockMs = 0;
            gamePhase = 'playing';
        },

        update(deltaMs: number): void {
            // Process restart request (allowed from any non-playing phase)
            const watched = watcher.poll();
            if (watched.restart.changed && watched.restart.value) {
                if (gamePhase !== 'playing') {
                    model.reset();
                }
            }

            if (gamePhase !== 'playing') return;
            clockMs += deltaMs;
            board.update(deltaMs);

            if (board.isGameOver) {
                gamePhase = 'game-over';
            }
        },
    };

    return model;
}
