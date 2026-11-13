import { STAR } from './cell-states';
import type { GameModel } from './game-model';

/**
 * Plays some of today's easy puzzle, as a player might: it opens it, places
 * the solution's stars in the top rows, and dots the cells round them. For
 * the thumbnail, and the visual tests, which show the game in play.
 */
export function playShowcase(model: GameModel): void {
    model.calendar.chooseLevel('easy');
    model.openPuzzle(model.calendar.today);
    const puzzle = model.puzzle;
    if (puzzle === undefined) return;
    const { grid, solution } = puzzle.puzzle;
    const shownCells = grid.size * SHOWN_ROWS;
    for (let cell = 0; cell < shownCells; cell++) {
        if (solution[cell] !== STAR) continue;
        puzzle.mark(cell, 'star');
        puzzle.startStroke();
        for (let k = 0; k < 8; k++) {
            const next = grid.neighbours[cell * 8 + k];
            if (next >= 0 && puzzle.markAt(next) === 'none') puzzle.mark(next, 'dot');
        }
        puzzle.finishStroke();
    }
}

/** How many rows, from the top, the showcase places the stars of. */
const SHOWN_ROWS = 4;
