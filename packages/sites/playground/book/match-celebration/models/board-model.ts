// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** The points each matched gem is worth. */
const POINTS_PER_GEM = 10;
/** How long the board spends matching, in ms. */
const MATCHING_MS = 1100;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The kinds of gem on the board. */
export type GemKind = 'ruby' | 'amber' | 'jade' | 'sapphire' | 'amethyst';

/** What the board is doing: waiting for a match, or clearing one. */
export type BoardPhase = 'idle' | 'matching';

/** A cell on the board, by its row and column, counted from 0 at the top left. */
export interface Cell {
    readonly row: number;
    readonly col: number;
}

/**
 * A board of gems. Matching a gem matches it and its neighbours in its row.
 * The board spends a moment matching, then new gems take the matched ones'
 * places. The model says only that the board is matching, and nothing about
 * how a match looks.
 */
export interface BoardModel {
    readonly rows: number;
    readonly cols: number;
    readonly phase: BoardPhase;
    readonly gemAt: (row: number, col: number) => GemKind;
    /** The cells of the last match. */
    readonly matchedCells: readonly Cell[];
    /** The points the last match scored. */
    readonly points: number;
    /** Matches the gem at this cell with its neighbours in its row, unless the board is already matching. */
    readonly matchAt: (row: number, col: number) => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a board of gems, waiting for a match. */
export function createBoardModel(): BoardModel {
    // Each cell's gem, as an index into KINDS, row by row
    const gems: number[] = [];
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) gems.push((row * 2 + col * 3) % KINDS.length);
    }
    const matchedCells: Cell[] = [];
    let phase: BoardPhase = 'idle';
    let points = 0;
    // How long the board has been matching, in ms
    let matchingMs = 0;

    const model: BoardModel = {
        rows: ROWS,
        cols: COLS,
        get phase() { return phase; },
        gemAt: (row, col) => KINDS[gems[row * COLS + col]],
        matchedCells,
        get points() { return points; },

        matchAt(row, col) {
            if (phase !== 'idle') return;
            // The gem and its neighbours, kept on the board at the ends of the row
            const first = Math.min(Math.max(col - 1, 0), COLS - MATCH_LENGTH);
            matchedCells.length = 0;
            for (let c = first; c < first + MATCH_LENGTH; c++) matchedCells.push({ row, col: c });
            points = MATCH_LENGTH * POINTS_PER_GEM;
            phase = 'matching';
            matchingMs = 0;
        },

        update(deltaMs) {
            if (phase !== 'matching') return;
            matchingMs += deltaMs;
            if (matchingMs < MATCHING_MS) return;
            // New gems take the matched ones' places
            for (let i = 0; i < matchedCells.length; i++) {
                const index = matchedCells[i].row * COLS + matchedCells[i].col;
                gems[index] = (gems[index] + 1 + i) % KINDS.length;
            }
            phase = 'idle';
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
