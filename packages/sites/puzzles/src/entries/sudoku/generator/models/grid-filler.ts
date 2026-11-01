import { CELL_COUNT, countDigits, findCandidates, pickDigit } from '../sudoku-grid';
import { type CellEvent, createCellEventLog } from './cell-event';
import { FILL_MOVE_BUDGET, SEED_COUNT } from './model-constants';
import type { Random } from './random';
import type { SearchLog } from './search-log';
import type { StepSolver } from './step-solver';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Making a full grid, as a view sees it: the seeds placed, and the times the search gave up. */
export interface GridFilling {
    /** Each random digit placed as a seed. */
    readonly seeds: CellEvent;
    /** Times the search gave up filling the grid, and started again from new seeds. */
    readonly restarts: number;
}

/**
 * Makes a full grid, a step at a time: it places random digits in random
 * cells, each breaking no rule, then searches for a way to fill the rest.
 * A search that runs past its budget gives up, and the grid is seeded
 * again, since starting afresh is quicker than searching on. The grid ends
 * up in the solver's digits.
 */
export interface GridFiller extends GridFilling {
    /** Whether it is placing seeds, or searching from them. */
    readonly phase: 'seeding' | 'filling';
    /** The seeds placed so far. */
    readonly seedDigits: Readonly<Uint8Array>;
    /** Whether the grid on show is the search's, rather than the seeds. */
    readonly isShowingSearch: boolean;
    /** Whether the grid is full. */
    readonly isFull: boolean;
    /** Starts again from an empty grid, for a new puzzle. Its counts are cleared apart, with `clearCounts`. */
    reset: () => void;
    /** Sets the counts back to nothing, and leaves the grid as it is, as the puzzles tried out of sight do. */
    clearCounts: () => void;
    /** Takes the next step, and says what it did. */
    step: () => 'seed-placed' | 'search-tried' | 'search-retreated' | 'fill-gave-up' | 'fill-solved';
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GridFillerOptions {
    /** Where the seeds, and the search's order, come from. */
    readonly random: Random;
    /** The search, which the filler shares with the other stages. */
    readonly solver: StepSolver;
    /** Where the search's moves are recorded. */
    readonly search: SearchLog;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a filler with an empty grid, ready to seed it. */
export function createGridFiller(options: GridFillerOptions): GridFiller {
    const { random, solver, search } = options;
    const seedDigits = new Uint8Array(CELL_COUNT);
    const seeds = createCellEventLog();
    let seedsInGrid = 0;
    let isSeeding = true;
    let phase: 'seeding' | 'filling' = 'seeding';
    let isShowingSearch = false;
    let isFull = false;
    let restarts = 0;

    return {
        seeds,
        get restarts() { return restarts; },
        get phase() { return phase; },
        seedDigits,
        get isShowingSearch() { return isShowingSearch; },
        get isFull() { return isFull; },
        reset() {
            seedDigits.fill(0);
            seedsInGrid = 0;
            isSeeding = true;
            isFull = false;
        },
        clearCounts,
        step() {
            if (isSeeding) {
                phase = 'seeding';
                isShowingSearch = false;
                if (seedsInGrid < SEED_COUNT) return placeSeed();
                solver.start(seedDigits, 'random');
                isSeeding = false;
            }
            return searchOnce();
        },
    };

    function clearCounts(): void {
        seeds.reset();
        restarts = 0;
    }

    /** Places a random digit that breaks no rule in a random empty cell. */
    function placeSeed(): 'seed-placed' {
        for (;;) {
            const cell = Math.floor(random.next() * CELL_COUNT);
            if (seedDigits[cell] !== 0) continue;
            const set = findCandidates(seedDigits, cell);
            if (set === 0) continue;
            seedDigits[cell] = pickDigit(set, Math.floor(random.next() * countDigits(set)));
            seedsInGrid++;
            seeds.record(cell, seedDigits[cell]);
            return 'seed-placed';
        }
    }

    function searchOnce(): 'search-tried' | 'search-retreated' | 'fill-gave-up' | 'fill-solved' {
        phase = 'filling';
        isShowingSearch = true;
        if (solver.status === 'searching' && solver.steps < FILL_MOVE_BUDGET) {
            solver.step();
            const move = search.recordMove(solver);
            if (move !== undefined) return move;
        }
        if (solver.status === 'solved') {
            isFull = true;
            return 'fill-solved';
        }
        // The search ran past its budget, or the seeds have no solution: wipe the grid, and seed again
        restarts++;
        seedDigits.fill(0);
        seedsInGrid = 0;
        isSeeding = true;
        return 'fill-gave-up';
    }
}
