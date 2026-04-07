// ---------------------------------------------------------------------------
// Cupcake
// ---------------------------------------------------------------------------

export type CupcakeKind = 'strawberry' | 'chocolate' | 'grape' | 'blueberry' | 'mint' | 'lemon';

export const ALL_CUPCAKE_KINDS: readonly CupcakeKind[] = [
    'strawberry',
    'chocolate',
    'grape',
    'blueberry',
    'mint',
    'lemon',
];

export interface CupcakeCell {
    readonly kind: CupcakeKind;
    /** Grid column (always integer). */
    readonly col: number;
    /** Grid row (always integer). */
    readonly row: number;
}

/** Sentinel singleton representing an empty grid position. */
export const EMPTY_CELL: CupcakeCell = Object.freeze({
    kind: 'strawberry' as CupcakeKind,
    col: -1,
    row: -1,
});

/** Create an immutable CupcakeCell. */
export function createCell(kind: CupcakeKind, row: number, col: number): CupcakeCell {
    return { kind, row, col };
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

export type BoardPhase =
    | 'idle'
    | 'swapping'
    | 'reversing'
    | 'matching'
    | 'settling';

export type GamePhase = 'playing' | 'game-over';
