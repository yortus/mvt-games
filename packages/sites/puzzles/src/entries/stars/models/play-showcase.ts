import { STAR } from './cell-states';
import type { GameModel } from './game-model';

/**
 * Plays some of today's hard puzzle, as a player might: it opens it, places
 * the solution's stars in the top rows, dots the cells round them, and
 * rings a group with a star in it further down. For the thumbnail, and the
 * visual tests, which show the game in play.
 */
export function playShowcase(model: GameModel): void {
    model.calendar.chooseLevel('hard');
    model.openPuzzle(model.calendar.today);
    const puzzle = model.puzzle;
    if (puzzle === undefined) return;
    const { grid, regions, solution } = puzzle.puzzle;
    const { size } = grid;
    for (let cell = 0; cell < size * SHOWN_ROWS; cell++) {
        if (solution[cell] !== STAR) continue;
        puzzle.mark(cell, 'star');
        for (let k = 0; k < 8; k++) {
            const next = grid.neighbours[cell * 8 + k];
            if (next >= 0 && puzzle.markAt(next) === 'none') puzzle.mark(next, 'dot');
        }
    }
    // A star below the rows shown, and not given, ringed with the cells beside it in its region
    for (let cell = size * (SHOWN_ROWS + 1); cell < grid.cellCount; cell++) {
        if (solution[cell] !== STAR || puzzle.isGivenAt(cell)) continue;
        const group = [cell];
        for (let side = 1; side < 4; side += 2) {
            const next = grid.sides[cell * 4 + side];
            if (next >= 0 && regions[next] === regions[cell]) group.push(next);
        }
        if (group.length < 2) continue;
        puzzle.noteGroup(group);
        return;
    }
}

/** How many rows, from the top, the showcase places the stars of. */
const SHOWN_ROWS = 4;
