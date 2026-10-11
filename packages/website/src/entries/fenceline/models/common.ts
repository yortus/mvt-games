// ---------------------------------------------------------------------------
// Directions
// ---------------------------------------------------------------------------

/** A way to go along the grid lines. */
export type Direction = 'up' | 'down' | 'left' | 'right';

/** The way to go, or none. */
export type HeldDirection = Direction | 'none';

/** One step in each direction: [rows, columns]. */
export const DIRECTION_DELTA: Readonly<Record<Direction, readonly [number, number]>> = {
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1],
};

/** Returns the opposite direction. */
export function reverse(direction: Direction): Direction {
    switch (direction) {
        case 'up': return 'down';
        case 'down': return 'up';
        case 'left': return 'right';
        case 'right': return 'left';
    }
}

/** Returns the direction a quarter turn clockwise. */
export function turnRight(direction: Direction): Direction {
    switch (direction) {
        case 'up': return 'right';
        case 'right': return 'down';
        case 'down': return 'left';
        case 'left': return 'up';
    }
}

/** Returns the direction a quarter turn anticlockwise. */
export function turnLeft(direction: Direction): Direction {
    switch (direction) {
        case 'up': return 'left';
        case 'left': return 'down';
        case 'down': return 'right';
        case 'right': return 'up';
    }
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

/**
 * Where the game is. A round starts with a moment to get `ready`. A snapped
 * wire or a beetle costs a life (`snapped`). Fencing off enough of the
 * meadow clears the round (`round-clear`).
 */
export type GamePhase = 'ready' | 'playing' | 'snapped' | 'round-clear' | 'game-over';
