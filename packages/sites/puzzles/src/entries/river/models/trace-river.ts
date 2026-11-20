import type { RiverPuzzle } from './river-puzzle';
import { RIVER } from './river-states';

/**
 * Returns the cells of `puzzle`'s solution in the order the river runs
 * through them, from the spring to the sea. For the showcase, which draws
 * the start of the river, and for the board, whose water flows down the
 * river in that order as the puzzle is solved.
 */
export function traceRiver(puzzle: RiverPuzzle): number[] {
    const { grid, spring, sea, solutionEdges } = puzzle;
    const { cellEdges, edgeCellA, edgeCellB } = grid;
    const cells = [spring];
    let from = -1;
    let cell = spring;
    while (cell !== sea) {
        let next = -1;
        for (let side = 0; side < 4 && next < 0; side++) {
            const edge = cellEdges[cell * 4 + side];
            if (edge < 0 || solutionEdges[edge] !== RIVER) continue;
            const other = edgeCellA[edge] === cell ? edgeCellB[edge] : edgeCellA[edge];
            if (other !== from) next = other;
        }
        // A solution is always one path from the spring to the sea, so this never happens
        if (next < 0) break;
        from = cell;
        cell = next;
        cells.push(cell);
    }
    return cells;
}
