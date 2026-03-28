// ---------------------------------------------------------------------------
// Cupcake
// ---------------------------------------------------------------------------

export type CupcakeKind = 'strawberry' | 'chocolate' | 'vanilla' | 'blueberry' | 'mint' | 'lemon';

export const ALL_CUPCAKE_KINDS: readonly CupcakeKind[] = [
    'strawberry',
    'chocolate',
    'vanilla',
    'blueberry',
    'mint',
    'lemon',
];

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

export type BoardPhase =
    | 'idle'
    | 'swapping'
    | 'reversing'
    | 'matching'
    | 'falling'
    | 'refilling';

export type GamePhase = 'playing' | 'game-over';
