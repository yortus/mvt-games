import { countSolutions } from './count-solutions.test-support';
import { findGivenPiece, NO_GIVEN } from './given-pieces';
import type { LevelSettings } from './levels';
import type { RiverPuzzle } from './river-puzzle';
import { createRiverSolver } from './river-solver';
import { RIVER } from './river-states';
import { traceRiver } from './trace-river';
import { DOWN, LEFT } from './valley-grid';

/**
 * Returns what is wrong with `puzzle`, made at `settings`, or an empty list:
 * its solution is one river from the spring to the sea, its numbers and
 * givens match it, it has one solution (counted by a search that shares
 * nothing with the maker), the level's techniques finish it from its
 * givens, it needs the level's hardest technique if the level asks, and
 * every given is needed.
 */
export function checkPuzzle(puzzle: RiverPuzzle, settings: LevelSettings): string[] {
    const { grid, spring, sea, rowCounts, colCounts, givens, solutionCells } = puzzle;
    const { size, cellCount } = grid;
    const problems: string[] = [];
    const river = traceRiver(puzzle);
    let riverCells = 0;
    const rows = new Array<number>(size).fill(0);
    const cols = new Array<number>(size).fill(0);
    for (let cell = 0; cell < cellCount; cell++) {
        if (solutionCells[cell] !== RIVER) continue;
        riverCells++;
        rows[Math.floor(cell / size)]++;
        cols[cell % size]++;
    }
    if (river[river.length - 1] !== sea || river.length !== riverCells) problems.push('the solution isn\'t one river from the spring to the sea');
    if (rows.join() !== rowCounts.join() || cols.join() !== colCounts.join()) problems.push('the numbers don\'t match the river');
    for (let cell = 0; cell < cellCount; cell++) {
        const endSide = cell === spring ? LEFT : cell === sea ? DOWN : -1;
        if (givens[cell] !== NO_GIVEN && givens[cell] !== findGivenPiece(grid, solutionCells, puzzle.solutionEdges, cell, endSide)) {
            problems.push(`given at ${cell} isn't the solution's`);
        }
    }
    if (countSolutions(puzzle, 2) !== 1) problems.push('not one solution');

    const solver = createRiverSolver({ grid, spring, sea, rowCounts, colCounts });
    const solved = solver.solve(givens, settings.hardest);
    if (!solved.isFinished) problems.push('the techniques don\'t finish it');
    if (settings.isHardestNeeded && solved.hardest !== settings.hardest) problems.push(`needs ${solved.hardest}, not ${settings.hardest}`);
    const without = givens.slice();
    for (let cell = 0; cell < cellCount; cell++) {
        if (givens[cell] === NO_GIVEN) continue;
        without[cell] = NO_GIVEN;
        if (solver.solve(without, settings.hardest).isFinished) problems.push(`given at ${cell} isn't needed`);
        without[cell] = givens[cell];
    }
    return problems;
}
