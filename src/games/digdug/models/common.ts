// ---------------------------------------------------------------------------
// Direction
// ---------------------------------------------------------------------------

export type Direction = 'none' | 'up' | 'down' | 'left' | 'right';

/** Returns the opposite direction. */
export function oppositeDirection(dir: Direction): Direction {
    switch (dir) {
        case 'up':    return 'down';
        case 'down':  return 'up';
        case 'left':  return 'right';
        case 'right': return 'left';
        case 'none':  return 'none';
    }
}

/** Directional deltas: [deltaRow, deltaCol]. */
export const DIRECTION_DELTA: Record<Direction, [number, number]> = {
    none: [0, 0],
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1],
};

// ---------------------------------------------------------------------------
// Enemy Types
// ---------------------------------------------------------------------------

export type EnemyKind = 'pooka' | 'fygar';

export type EnemyPhase = 'patrol' | 'chase' | 'ghosting' | 'inflating' | 'popped' | 'crushed' | 'fleeing';

export type InflationStage = 0 | 1 | 2 | 3 | 4;

// ---------------------------------------------------------------------------
// Rock
// ---------------------------------------------------------------------------

export type RockPhase = 'stable' | 'wobbling' | 'falling' | 'shattered';

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

export type GamePhase = 'playing' | 'level-clear' | 'dying' | 'game-over';
