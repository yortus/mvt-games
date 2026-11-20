import { DRY } from './river-states';
import type { GameModel } from './game-model';
import { traceRiver } from './trace-river';

/**
 * Plays some of today's hard puzzle, as a player might, so the game shows a
 * puzzle in play. It opens the puzzle, draws the first half of the river
 * from the spring, and marks the dry cells beside it as meadow.
 */
export function playShowcase(model: GameModel): void {
    model.calendar.chooseLevel('hard');
    model.openPuzzle(model.calendar.today);
    const puzzle = model.puzzle;
    if (puzzle === undefined) return;
    const { grid, solutionCells } = puzzle.puzzle;
    const river = traceRiver(puzzle.puzzle);
    const drawn = Math.floor(river.length / 2);
    puzzle.startStroke();
    for (let i = 1; i <= drawn; i++) puzzle.setRiver(grid.edgeBetween(river[i - 1], river[i]), true);
    puzzle.finishStroke();
    // The dry cells beside the river drawn
    for (let i = 0; i <= drawn; i++) {
        for (let side = 0; side < 4; side++) {
            const edge = grid.cellEdges[river[i] * 4 + side];
            if (edge < 0) continue;
            const other = grid.cellAcross(edge, river[i]);
            if (solutionCells[other] === DRY) puzzle.setMeadow(other, true);
        }
    }
}
