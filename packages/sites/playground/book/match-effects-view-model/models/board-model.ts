// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** The points each matched gem is worth, before the chain multiplies them. */
const POINTS_PER_GEM = 10;
/** How long a chain waits for its next match, in ms. */
const CHAIN_MS = 1500;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The kinds of gem on the board. */
export type GemKind = 'ruby' | 'amber' | 'jade' | 'sapphire' | 'amethyst';

/** A cell on the board, by its row and column, counted from 0 at the top left. */
export interface Cell {
    readonly row: number;
    readonly col: number;
}

/**
 * A board of gems. Matching a gem matches it and its neighbours in its row,
 * and new gems take their places. Matches made in quick succession make a
 * chain, which ends when the player stops matching for a moment.
 */
export interface BoardModel {
    readonly rows: number;
    readonly cols: number;
    readonly gemAt: (row: number, col: number) => GemKind;
    /** The cells of the last match. */
    readonly matchedCells: readonly Cell[];
    /** The points the last match scored. */
    readonly points: number;
    /** Matches made in a row in this chain, and 0 between chains. */
    readonly cascadeStep: number;
    /** Matches the gem at this cell with its neighbours in its row. */
    readonly matchAt: (row: number, col: number) => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a board of gems, with no chain under way. */
export function createBoardModel(): BoardModel {
    // Each cell's gem, as an index into KINDS, row by row
    const gems: number[] = [];
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) gems.push((row * 2 + col * 3) % KINDS.length);
    }
    const matchedCells: Cell[] = [];
    let points = 0;
    let cascadeStep = 0;
    // How much longer the chain lasts without another match, in ms
    let chainLeftMs = 0;

    const model: BoardModel = {
        rows: ROWS,
        cols: COLS,
        gemAt: (row, col) => KINDS[gems[row * COLS + col]],
        matchedCells,
        get points() { return points; },
        get cascadeStep() { return cascadeStep; },

        matchAt(row, col) {
            // The gem and its neighbours, kept on the board at the ends of the row
            const first = Math.min(Math.max(col - 1, 0), COLS - MATCH_LENGTH);
            matchedCells.length = 0;
            for (let c = first; c < first + MATCH_LENGTH; c++) {
                matchedCells.push({ row, col: c });
                // A new gem takes the matched one's place
                const index = row * COLS + c;
                gems[index] = (gems[index] + 1 + c) % KINDS.length;
            }
            cascadeStep += 1;
            chainLeftMs = CHAIN_MS;
            // Each match in a chain scores more than the last
            points = MATCH_LENGTH * POINTS_PER_GEM * cascadeStep;
        },

        update(deltaMs) {
            if (cascadeStep === 0) return;
            chainLeftMs -= deltaMs;
            if (chainLeftMs <= 0) cascadeStep = 0;
        },
    };

    return model;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ROWS = 5;
const COLS = 7;
const MATCH_LENGTH = 3;

const KINDS: readonly GemKind[] = ['ruby', 'amber', 'jade', 'sapphire', 'amethyst'];
