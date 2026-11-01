import { swapColumns, swapDigits, swapStacks, turnGrid } from './grid-shuffles';
import { SHUFFLE_COUNT } from './model-constants';
import type { Random } from './random';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The ways the dug puzzle is shuffled: two digits swapped, two columns of a stack, two stacks, and a quarter turn. */
export type ShuffleKind = 'digits' | 'columns' | 'stacks' | 'turn';

/** Shuffling the dug puzzle, as a view sees it. */
export interface GridShuffling {
    /** The last shuffle, or undefined before the first. */
    readonly kind: ShuffleKind | undefined;
    /** What the last shuffle swapped: two digits, two columns, or two stacks, 0 to 2. */
    readonly first: number;
    readonly second: number;
    /** Shuffles made so far for this puzzle. */
    readonly count: number;
}

/**
 * Shuffles the dug puzzle a few times, a shuffle at a time, in ways that
 * keep it just as hard: two digits swap everywhere, two columns of a stack
 * swap, two stacks swap, and the grid turns a quarter. The shuffles hide
 * the order the cells were dug in.
 */
export interface GridShuffler extends GridShuffling {
    /** Whether every shuffle is made. */
    readonly isDone: boolean;
    /** Forgets the last shuffle, for a new puzzle. Its count is cleared apart, with `clearCounts`. */
    reset: () => void;
    /** Sets the count back to nothing, as the puzzles tried out of sight do. */
    clearCounts: () => void;
    /** Makes the next shuffle. */
    step: () => 'shuffled';
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GridShufflerOptions {
    /** Where the shuffles' choices come from. */
    readonly random: Random;
    /** The grids it shuffles, all in the same way: the full grid, the puzzle dug from it, and each cell's dig mark. */
    readonly solution: Uint8Array;
    readonly puzzle: Uint8Array;
    readonly marks: Uint8Array;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a shuffler with nothing shuffled yet. */
export function createGridShuffler(options: GridShufflerOptions): GridShuffler {
    const { random, solution, puzzle, marks } = options;
    const scratch = new Uint8Array(solution.length);
    let kind: ShuffleKind | undefined;
    let first = 0;
    let second = 0;
    let count = 0;

    return {
        get kind() { return kind; },
        get first() { return first; },
        get second() { return second; },
        get count() { return count; },
        get isDone() { return count === SHUFFLE_COUNT; },
        reset() { kind = undefined; },
        clearCounts() { count = 0; },
        step() {
            kind = SHUFFLE_KINDS[count % SHUFFLE_KINDS.length];
            switch (kind) {
                case 'digits':
                    pickTwo(9);
                    first++;
                    second++;
                    swapDigits(solution, first, second);
                    swapDigits(puzzle, first, second);
                    break;
                case 'columns': {
                    const stack = Math.floor(random.next() * 3);
                    pickTwo(3);
                    first += stack * 3;
                    second += stack * 3;
                    swapColumns(solution, first, second);
                    swapColumns(puzzle, first, second);
                    swapColumns(marks, first, second);
                    break;
                }
                case 'stacks':
                    pickTwo(3);
                    swapStacks(solution, first, second);
                    swapStacks(puzzle, first, second);
                    swapStacks(marks, first, second);
                    break;
                case 'turn':
                    turnGrid(solution, scratch);
                    turnGrid(puzzle, scratch);
                    turnGrid(marks, scratch);
                    break;
            }
            count++;
            return 'shuffled';
        },
    };

    /** Sets `first` and `second` to two different whole numbers below `n`, the smaller first. */
    function pickTwo(n: number): void {
        const a = Math.floor(random.next() * n);
        const b = (a + 1 + Math.floor(random.next() * (n - 1))) % n;
        first = Math.min(a, b);
        second = Math.max(a, b);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SHUFFLE_KINDS: readonly ShuffleKind[] = ['digits', 'columns', 'stacks', 'turn'];
