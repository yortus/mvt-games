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

// ---------------------------------------------------------------------------
// Position
// ---------------------------------------------------------------------------

export interface Position {
    col: number;
    row: number;
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
