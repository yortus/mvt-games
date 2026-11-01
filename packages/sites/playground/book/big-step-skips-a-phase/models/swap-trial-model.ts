import { SWAP_DURATION_MS } from '../data';
import { type BoardModel, type CellKind, createBoardModel } from './board-model';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long each run's result shows before the next run starts, in ms. */
const ASSERT_MS = 2400;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Whether the trial is moving time on, or showing what its check found. */
export type TrialPhase = 'acting' | 'asserting';

/**
 * Runs one test over and over, on two boards at once, as a test runner
 * would, but slowly enough to watch. Each run makes both boards, swaps their
 * top left two cactii, and moves time on by three swaps' worth. Then it holds
 * still for a while, so you can read whether each board has settled.
 *
 * One board is moved on a frame at a time, as `advanceTime` does. The other
 * is moved on in big steps.
 */
export interface SwapTrialModel {
    readonly phase: TrialPhase;
    /** The board moved on a frame at a time. */
    readonly frameBoard: BoardModel;
    /** The board moved on in big steps. */
    readonly bigStepBoard: BoardModel;
    /** How much time each big step moves on, in ms. */
    readonly bigStepMs: number;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SwapTrialModelOptions {
    /** What each board's cells hold at the start of each run. */
    readonly startKinds: readonly (readonly CellKind[])[];
    /** How much time each big step moves on, in ms. */
    readonly bigStepMs: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a trial, with its first run just started. */
export function createSwapTrialModel({ startKinds, bigStepMs }: SwapTrialModelOptions): SwapTrialModel {
    let phase: TrialPhase = 'acting';
    let frameBoard = startBoard();
    let bigStepBoard = startBoard();
    // How long this run has been in its phase, in ms
    let phaseMs = 0;
    // Time that has passed, but that the big-step board hasn't been given yet, in ms
    let owedMs = 0;

    const model: SwapTrialModel = {
        get phase() { return phase; },
        get frameBoard() { return frameBoard; },
        get bigStepBoard() { return bigStepBoard; },
        bigStepMs,

        update(deltaMs) {
            phaseMs += deltaMs;
            if (phase === 'acting') {
                frameBoard.update(deltaMs);
                owedMs += deltaMs;
                while (owedMs >= bigStepMs) {
                    owedMs -= bigStepMs;
                    bigStepBoard.update(bigStepMs);
                }
                if (phaseMs >= ACT_MS) {
                    phase = 'asserting';
                    phaseMs = 0;
                }
            }
            else if (phaseMs >= ASSERT_MS) {
                frameBoard = startBoard();
                bigStepBoard = startBoard();
                phase = 'acting';
                phaseMs = 0;
                owedMs = 0;
            }
        },
    };

    return model;

    /** Makes a board, and swaps its top left two cactii, as the test does. */
    function startBoard(): BoardModel {
        const board = createBoardModel({ startKinds });
        board.trySwap(board.cells[0][0], board.cells[0][1]);
        return board;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How much time each run moves on, as the test's `advanceTime(3 * SWAP_DURATION_MS, board)` does. */
const ACT_MS = 3 * SWAP_DURATION_MS;
