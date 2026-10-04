export type Direction = 'up' | 'down' | 'left' | 'right';

/** Returns the opposite direction. */
export function oppositeDirection(dir: Direction): Direction {
    switch (dir) {
        case 'up':    return 'down';
        case 'down':  return 'up';
        case 'left':  return 'right';
        case 'right': return 'left';
    }
}

/** Directional deltas: [deltaRow, deltaCol]. */
export const DIRECTION_DELTA: Record<Direction, [number, number]> = {
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1],
};
