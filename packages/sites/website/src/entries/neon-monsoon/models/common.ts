// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

/** A position in the arena, in world-units. Models that have one satisfy it. */
export interface Point {
    readonly x: number;
    readonly y: number;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type XDirection = 'left' | 'none' | 'right';

export type YDirection = 'up' | 'none' | 'down';

// ---------------------------------------------------------------------------
// Things in the arena
// ---------------------------------------------------------------------------

/** The player's two shots: the wide spread, and the narrow column fired while focused. */
export type ShotKind = 'shot' | 'shot-focused';

export type ExplosionSize = 'small' | 'large' | 'huge';

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

/**
 * - `'playing'`: the ship is flying.
 * - `'dying'`: the ship has been hit; the world goes on without it for a moment.
 * - `'tally'`: the boss is down, and the stage-clear bonus is shown before the next loop.
 * - `'game-over'` and `'all-clear'`: the run is over, lost or won, and the world stands still.
 */
export type GamePhase = 'playing' | 'dying' | 'tally' | 'game-over' | 'all-clear';
