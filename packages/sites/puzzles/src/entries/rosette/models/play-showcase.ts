import type { GameModel } from './game-model';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ShowcaseOptions {
    readonly model: GameModel;
    /**
     * How much of the picture, from the middle out, is put back, from 0 to 1.
     * 1 mends the window. Without it, most of it is, as a player partway
     * through would have.
     */
    readonly placedShare?: number;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Plays some of today's medium puzzle, as a player might: it opens it,
 * unless a puzzle is open already, and puts the pieces nearest the middle
 * back on their own tiles, so the gradient shows through the jumble. For
 * the thumbnail, and the visual tests, which show the game in play. Played
 * again with a larger share, it carries on in the puzzle open.
 */
export function playShowcase(options: ShowcaseOptions): void {
    const { model, placedShare = PLACED_SHARE } = options;
    if (model.puzzle === undefined) {
        model.calendar.chooseLevel('medium');
        model.openPuzzle(model.calendar.today);
    }
    const puzzle = model.puzzle;
    if (puzzle === undefined) return;
    const count = puzzle.puzzle.patch.count;
    // Tiles are numbered nearest the middle first
    const placed = Math.floor(count * placedShare);
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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How much of the picture, from the middle out, the showcase puts back unless told. */
const PLACED_SHARE = 0.7;
