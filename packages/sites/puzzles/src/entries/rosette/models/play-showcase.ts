import type { GameModel } from './game-model';

/**
 * Plays some of today's medium puzzle, as a player might: it opens it, and
 * puts most of the pieces nearest the middle back on their own tiles, so
 * the gradient shows through the jumble. For the thumbnail, and the visual
 * tests, which show the game in play.
 */
export function playShowcase(model: GameModel): void {
    model.calendar.chooseLevel('medium');
    model.openPuzzle(model.calendar.today);
    const puzzle = model.puzzle;
    if (puzzle === undefined) return;
    const count = puzzle.puzzle.patch.count;
    // Tiles are numbered nearest the middle first
    const placed = Math.floor(count * PLACED_SHARE);
    for (let tile = 0; tile < placed; tile++) {
        if (puzzle.pieceAt(tile) === tile) continue;
        // Find where this tile's own piece is, and swap it home
        for (let other = 0; other < count; other++) {
            if (puzzle.pieceAt(other) !== tile) continue;
            puzzle.swap(tile, other);
            break;
        }
    }
}

/** How much of the picture, from the middle out, the showcase puts back. */
const PLACED_SHARE = 0.7;
