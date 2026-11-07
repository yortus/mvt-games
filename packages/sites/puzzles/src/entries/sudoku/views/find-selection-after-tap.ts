// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * The cells selected once the player taps `cell`, from `selected`: a tap
 * takes a cell out of several selected, clears the one selected, and
 * otherwise selects the cell alone.
 */
export function findSelectionAfterTap(selected: readonly number[], cell: number): readonly number[] {
    if (selected.length > 1 && selected.includes(cell)) return selected.filter((each) => each !== cell);
    if (selected.length === 1 && selected[0] === cell) return NONE;
    return [cell];
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NONE: readonly number[] = [];
