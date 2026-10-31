import type { GridShuffling } from '../models';
import { COLUMN_OF, easeInOut } from '../sudoku-grid';
import { CELL_SIZE } from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * How the grid moves as a shuffle plays out: the columns or stacks that
 * swap slide past each other, one in front of the other, the digits that
 * swap pulse, and a turn turns the whole grid, shrinking it to fit as it
 * tilts. Each is worked out afresh from how far the shuffle has gone, so
 * the view model keeps no state.
 */
export interface ShuffleMotionViewModel {
    /** How far the board is turned, in radians: from a quarter turn back to none, during a turn. */
    readonly rotation: number;
    /** How much the board is shrunk, so its corners stay inside its own square as it tilts. */
    readonly scale: number;
    /** How far `cell` is from its place, in pixels, as its column, or its stack, slides into its new one. */
    slideAt: (cell: number) => number;
    /**
     * Of two columns crossing, how far `cell` is in front, above 0, or
     * behind, below 0: at most 1 either way, as they cross.
     */
    depthAt: (cell: number) => number;
    /** How strongly `digit` pulses as it swaps, from 0 to 1, or 0 for a digit not being swapped. */
    swapPulseFor: (digit: number) => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ShuffleMotionViewModelOptions {
    /** The shuffles, the last of which may be moving. */
    readonly shuffle: GridShuffling;
    /** How far the last shuffle has moved, from 0 to 1. 1 when no shuffle is moving. */
    readonly progress: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the motion of the grid's shuffles. */
export function createShuffleMotionViewModel(options: ShuffleMotionViewModelOptions): ShuffleMotionViewModel {
    const { shuffle, progress } = options;
    return {
        get rotation() { return -findAngle(); },
        get scale() {
            const angle = findAngle();
            return 1 / (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)));
        },
        slideAt,
        depthAt: (cell) => Math.sign(slideAt(cell)) * findPulse(),
        swapPulseFor: (digit) => (shuffle.kind === 'digits' && (digit === shuffle.first || digit === shuffle.second) ? findPulse() : 0),
    };

    /** How far the cells still have to go, from 1 down to 0, eased so they set off and arrive gently. */
    function findLeft(): number {
        const p = progress();
        return p >= 1 ? 0 : 1 - easeInOut(p);
    }

    /** A swell from 0 to 1 and back over the shuffle. */
    function findPulse(): number {
        const p = progress();
        return p >= 1 ? 0 : Math.sin(p * Math.PI);
    }

    function findAngle(): number {
        return shuffle.kind === 'turn' ? findLeft() * Math.PI / 2 : 0;
    }

    function slideAt(cell: number): number {
        const left = findLeft();
        if (left <= 0) return 0;
        if (shuffle.kind === 'columns') return computeSlide(COLUMN_OF[cell], 1) * left;
        if (shuffle.kind === 'stacks') return computeSlide(Math.floor(COLUMN_OF[cell] / 3), 3) * left;
        return 0;
    }

    /**
     * How far a column, or a stack of `width` columns, is from where it was
     * before the shuffle, in pixels. The two that swapped each came from the
     * other's place.
     */
    function computeSlide(place: number, width: number): number {
        if (place === shuffle.first) return (shuffle.second - shuffle.first) * width * CELL_SIZE;
        if (place === shuffle.second) return (shuffle.first - shuffle.second) * width * CELL_SIZE;
        return 0;
    }
}
