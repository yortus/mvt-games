import { BOAT } from './cell-states';
import { countSolutions } from './count-solutions.test-support';
import { findGivenPiece, NO_GIVEN } from './given-pieces';
import type { LevelSettings } from './levels';
import { createBoatSolver } from './boat-solver';
import type { BoatPuzzle } from './boat-puzzle';

/**
 * Returns what is wrong with `puzzle`, made at `settings`, or an empty list:
 * its solution holds the fleet with no two boats touching, its numbers and
 * givens match its solution, it has one solution (counted by a search that
 * shares nothing with the maker), if `isCounted`, the level's techniques
 * finish it from its givens, it needs the level's hardest technique if the
 * level asks, and every given is needed.
 */
export function checkPuzzle(puzzle: BoatPuzzle, settings: LevelSettings, isCounted: boolean): string[] {
    const { grid, fleet, rowCounts, colCounts, givens, solution } = puzzle;
    const { size, cellCount } = grid;
    const problems: string[] = [];
    // The boats, as the lengths of the straight runs of boat cells, and no two touching diagonally
    const lengths: number[] = [];
    const rows = new Array<number>(size).fill(0);
    const cols = new Array<number>(size).fill(0);
    for (let cell = 0; cell < cellCount; cell++) {
        if (solution[cell] !== BOAT) continue;
        const row = Math.floor(cell / size);
        const col = cell % size;
        rows[row]++;
        cols[col]++;
        if (row + 1 < size && ((col > 0 && solution[cell + size - 1] === BOAT) || (col + 1 < size && solution[cell + size + 1] === BOAT))) {
            problems.push(`boats touch diagonally at ${cell}`);
        }
        const isStartAcross = col === 0 || solution[cell - 1] !== BOAT;
        const isStartDown = row === 0 || solution[cell - size] !== BOAT;
        if (!isStartAcross || !isStartDown) continue;
        let across = 1;
        while (col + across < size && solution[cell + across] === BOAT) across++;
        let down = 1;
        while (row + down < size && solution[cell + down * size] === BOAT) down++;
        if (across > 1 && down > 1) problems.push(`a boat bends at ${cell}`);
        lengths.push(Math.max(across, down));
    }
    lengths.sort((a, b) => b - a);
    if (lengths.join() !== fleet.join()) problems.push(`boats ${lengths.join()} aren't the fleet ${fleet.join()}`);
    if (rows.join() !== rowCounts.join() || cols.join() !== colCounts.join()) problems.push('the numbers don\'t match the boats');
    for (let cell = 0; cell < cellCount; cell++) {
        if (givens[cell] !== NO_GIVEN && givens[cell] !== findGivenPiece(grid, solution, cell)) problems.push(`given at ${cell} isn't the solution's`);
    }
    if (isCounted && countSolutions(puzzle, 2) !== 1) problems.push('not one solution');

    const solver = createBoatSolver({ grid, fleet, rowCounts, colCounts });
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
