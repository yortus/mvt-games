import { type CellEvent, createCellEventLog } from './cell-event';
import type { StepSolver } from './step-solver';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The search's moves for this puzzle, whatever it is searching for: to fill
 * the grid, to test a cell being dug, or to finish a puzzle the grader is
 * stuck on.
 */
export interface SearchMoves {
    /** Its tries, each of which put a digit in a cell. */
    readonly tries: CellEvent;
    /** Its retreats, each of which took a digit out of a cell at a dead end. */
    readonly retreats: CellEvent;
}

/** The search's moves, as the models that run the search see them. */
export interface SearchLog extends SearchMoves {
    /** Records the search's last move, if it made one, and says which kind of step that was. */
    recordMove: (solver: StepSolver) => 'search-tried' | 'search-retreated' | undefined;
    /** Forgets every move, for a new puzzle. */
    reset: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a log with no moves in it. */
export function createSearchLog(): SearchLog {
    const tries = createCellEventLog();
    const retreats = createCellEventLog();
    return {
        tries,
        retreats,
        recordMove(solver) {
            if (solver.lastMove === 'none') return undefined;
            if (solver.lastMove === 'try') {
                tries.record(solver.lastCell, solver.lastDigit);
                return 'search-tried';
            }
            retreats.record(solver.lastCell, solver.lastDigit);
            return 'search-retreated';
        },
        reset() {
            tries.reset();
            retreats.reset();
        },
    };
}
