import { BOAT } from './cell-states';
import type { GameModel } from './game-model';

/**
 * Plays some of today's hard puzzle, as a player might: it opens it, moors
 * the solution's boats in the top rows, and marks the water round them. For
 * the thumbnail, and the visual tests, which show the game in play.
 */
export function playShowcase(model: GameModel): void {
    model.calendar.chooseLevel('hard');
    model.openPuzzle(model.calendar.today);
    const puzzle = model.puzzle;
    if (puzzle === undefined) return;
    const { grid, solution } = puzzle.puzzle;
    const { size } = grid;
    for (let cell = 0; cell < size * SHOWN_ROWS; cell++) {
        if (solution[cell] === BOAT) puzzle.mark(cell, 'boat');
    }
    // The water beside each boat, in the rows shown
    for (let cell = 0; cell < size * SHOWN_ROWS; cell++) {
        if (solution[cell] === BOAT) continue;
        for (let side = 0; side < 4; side++) {
            const next = grid.sides[cell * 4 + side];
            if (next >= 0 && next < size * SHOWN_ROWS && solution[next] === BOAT) puzzle.mark(cell, 'water');
        }
    }
}

/** How many rows, from the top, the showcase moors the boats of. */
const SHOWN_ROWS = 4;
