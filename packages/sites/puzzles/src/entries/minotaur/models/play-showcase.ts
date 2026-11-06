import { PASSAGE, WALL } from './edge-states';
import type { GameModel } from './game-model';

/**
 * Plays some of today's medium puzzle, as a player might: it opens it,
 * draws the path from the start most of the way across, and marks a few
 * walls the solution has along the far side. For the thumbnail, and the
 * visual tests, which show the game in play.
 */
export function playShowcase(model: GameModel): void {
    model.calendar.chooseLevel('medium');
    model.openPuzzle(model.calendar.today);
    const puzzle = model.puzzle;
    if (puzzle === undefined) return;
    const { grid, start, solution } = puzzle.maze;

    // Follow the solution from the start, a passage at a time
    puzzle.startStroke();
    let previous = -1;
    let cell = start;
    for (let step = 0; step < Math.floor(grid.cellCount * PATH_SHARE); step++) {
        let next = -1;
        for (let side = 0; side < 4; side++) {
            const edge = grid.cellEdges[cell * 4 + side];
            if (edge < 0 || solution[edge] !== PASSAGE) continue;
            const other = grid.edgeCellA[edge] === cell ? grid.edgeCellB[edge] : grid.edgeCellA[edge];
            if (other === previous) continue;
            puzzle.mark(edge, 'passage');
            next = other;
        }
        if (next < 0) break;
        previous = cell;
        cell = next;
    }
    puzzle.finishStroke();

    // A few of the walls on the last lines between columns
    puzzle.startStroke();
    const lastLine = grid.lineEdges[grid.columnLineCount - 1];
    for (let i = 0; i < lastLine.length; i++) {
        if (solution[lastLine[i]] === WALL) puzzle.mark(lastLine[i], 'wall');
    }
    puzzle.finishStroke();
}

/** How much of the path the showcase draws. */
const PATH_SHARE = 0.55;
