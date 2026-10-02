// ---------------------------------------------------------------------------
// Cactus
// ---------------------------------------------------------------------------

export type CactusKind = 'astrophytum' | 'cereus' | 'euphorbia' | 'ferocactus' | 'opuntia' | 'rebutia';

export const ALL_CACTUS_KINDS: readonly CactusKind[] = [
    'astrophytum',
    'cereus',
    'euphorbia',
    'ferocactus',
    'opuntia',
    'rebutia',
];

export interface CactusCell {
    readonly kind: CactusKind;
    /** Grid column (always integer). */
    readonly col: number;
    /** Grid row (always integer). */
    readonly row: number;
}

/**
 * Sentinel singleton representing an empty grid position.
 *
 * Always check via identity (`cell === EMPTY_CELL`), never read its `kind`,
 * `row`, or `col` - those carry placeholder values with no semantic meaning.
 */
export const EMPTY_CELL: CactusCell = Object.freeze({
    kind: 'astrophytum' as CactusKind,
    col: -1,
    row: -1,
});

/** Create an immutable CactusCell. */
export function createCell(kind: CactusKind, row: number, col: number): CactusCell {
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
