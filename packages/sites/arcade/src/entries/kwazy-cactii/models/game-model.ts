import type { CactusCell, CactusKind, GamePhase } from './common';
import { ALL_CACTUS_KINDS } from './common';
import { createBoardModel, type BoardModel } from './board-model';
import { findMatches, hasAvailableMove } from './grid-helpers';
import { watch } from '@mvtjs/utils';

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
    trySwap: (cell1: CactusCell, cell2: CactusCell) => boolean;
    /** Reset the game to initial state. */
    reset: () => void;
    /**
     * Returns the game as it stands, as a value JSON can hold, for `load` to
     * restore. While a swap plays out, it returns the board as it stood
     * before the swap. Returns undefined once the game is over, and until
     * the first line is made, since resuming before that would only start
     * the game again.
     */
    save: () => SavedGame | undefined;
    /**
     * Restores a game that `save` returned, in place of this one. Returns
     * whether it could: a value that is not a board of this size at rest,
     * such as one from an older version, leaves the game as it was.
     */
    load: (saved: unknown) => boolean;
    update: (deltaMs: number) => void;
}

/** A game part way through, as `save` returns it: a board at rest, and the score. */
export interface SavedGame {
    readonly version: typeof SAVED_GAME_VERSION;
    readonly score: number;
    /** The cactii, as `kinds[row][col]`. */
    readonly kinds: readonly (readonly CactusKind[])[];
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
    /** The board as it stood before the swap now playing out, for a save made before it comes to rest. */
    let savedBeforeSwap: SavedGame | undefined;

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
            // The board is at rest, or it would refuse the swap
            const before = saveBoard();
            if (!board.trySwap(cell1, cell2)) return false;
            savedBeforeSwap = before;
            return true;
        },

        reset(): void {
            board = createBoardModel(options);
            clockMs = 0;
            gamePhase = 'playing';
        },

        save() {
            if (gamePhase !== 'playing') return undefined;
            const saved = board.phase === 'idle' ? saveBoard() : savedBeforeSwap;
            // A board with no line made yet has nothing worth resuming. Resuming it would only start the game again
            return saved !== undefined && saved.score > 0 ? saved : undefined;
        },

        load(value) {
            const loaded = boardFrom(value);
            if (loaded === undefined) return false;
            board = loaded;
            clockMs = 0;
            gamePhase = 'playing';
            return true;
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

    // ---- Saved games -------------------------------------------------------

    function saveBoard(): SavedGame {
        const kinds: CactusKind[][] = [];
        for (let r = 0; r < board.rowCount; r++) {
            kinds.push([]);
            for (let c = 0; c < board.colCount; c++) kinds[r].push(board.cells[r][c].kind);
        }
        return { version: SAVED_GAME_VERSION, score: board.score, kinds };
    }

    /**
     * Returns a board made from `value`, if it is a saved game of a board
     * this size at rest: full of cactii, with no line on it, and a move left.
     */
    function boardFrom(value: unknown): BoardModel | undefined {
        if (!isRecord(value) || value.version !== SAVED_GAME_VERSION) return undefined;
        const { score, kinds } = value;
        if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) return undefined;
        if (!Array.isArray(kinds) || kinds.length !== board.rowCount) return undefined;
        for (let r = 0; r < kinds.length; r++) {
            const row: unknown = kinds[r];
            if (!Array.isArray(row) || row.length !== board.colCount) return undefined;
            for (let c = 0; c < row.length; c++) {
                if (!ALL_CACTUS_KINDS.includes(row[c] as CactusKind)) return undefined;
            }
        }
        const loaded = createBoardModel({ ...options, startKinds: kinds as CactusKind[][], startScore: score });
        const { cells, rowCount, colCount } = loaded;
        if (findMatches(cells, rowCount, colCount).length > 0 || !hasAvailableMove(cells, rowCount, colCount)) return undefined;
        return loaded;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Marks the shape of a saved game. A change to the shape changes it, so older saves are not loaded. */
const SAVED_GAME_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
    // typeof null is 'object' too
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
