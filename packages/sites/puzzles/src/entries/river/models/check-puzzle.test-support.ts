import { countSolutions } from './count-solutions.test-support';
import { findEndSide, findGivenPiece, NO_GIVEN } from './given-pieces';
import type { LevelSettings } from './levels';
import type { RiverPuzzle } from './river-puzzle';
import { createRiverSolver } from './river-solver';
import { RIVER } from './river-states';
import { traceRiver } from './trace-river';

/**
 * Returns what is wrong with `puzzle`, made at `settings`, or an empty list
 * if the puzzle is sound. It checks that the solution is one river from the
 * spring to the sea, and that the numbers and the givens match it. It
 * checks that the puzzle has one solution, counted by a search that shares
 * no code with the maker. It also checks that the level's techniques finish
 * the puzzle from its givens, that it needs the level's hardest technique
 * if the level requires that, and that every given is needed.
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
        const endSide = findEndSide(cell, spring, sea);
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
