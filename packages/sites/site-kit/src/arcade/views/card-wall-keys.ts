// How the keyboard moves the selection across the card wall. Every card is
// the same size, so the wall lays them out in rows, in the order shown:
// left and right step through that order, up and down a column at a time.

/** A way the selection can move. */
export type WallMoveKind = 'left' | 'right' | 'up' | 'down';

/** The move a key asks for: an arrow, or W, A, S or D. */
export function wallMoveFor(key: string): WallMoveKind | undefined {
    switch (key) {
        case 'ArrowLeft': case 'a': case 'A': return 'left';
        case 'ArrowRight': case 'd': case 'D': return 'right';
        case 'ArrowUp': case 'w': case 'W': return 'up';
        case 'ArrowDown': case 's': case 'S': return 'down';
        default: return undefined;
    }
}

/**
 * The position, in the order shown, that `move` takes the selection to from
 * `position`, on a wall `columnCount` cards wide showing `shownCount` cards.
 * A move off the wall's edge stays put; down from a card with none below it
 * in a short last row goes to the last card.
 */
export function movedPosition(options: {
    position: number;
    move: WallMoveKind;
    shownCount: number;
    columnCount: number;
}): number {
    const { position, move, shownCount, columnCount } = options;
    if (shownCount === 0) return -1;
    const last = shownCount - 1;
    switch (move) {
        case 'left': return Math.max(0, position - 1);
        case 'right': return Math.min(last, position + 1);
        case 'up': return position - columnCount >= 0 ? position - columnCount : position;
        case 'down': {
            const below = position + columnCount;
            if (below <= last) return below;
            // A row further down exists, but is too short to reach under this card
            return Math.floor(last / columnCount) > Math.floor(position / columnCount) ? last : position;
        }
    }
}
