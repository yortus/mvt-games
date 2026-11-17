import { STAR, UNKNOWN } from './cell-states';
import { countSolutions } from './count-solutions.test-support';
import type { LevelSettings } from './levels';
import type { StarPuzzle } from './star-puzzle';
import { createStarSolver } from './star-solver';

/**
 * Returns what is wrong with `puzzle`, made at `settings`, or an empty list:
 * its solution keeps every rule, its regions are whole and no one-star
 * region is a single cell, it has one solution (counted by a search that
 * shares nothing with the maker), the level's techniques finish it from its
 * givens, it needs the level's hardest technique if the level asks, and
 * every given is needed.
 */
export function checkPuzzle(puzzle: StarPuzzle, settings: LevelSettings): string[] {
    const { grid, regions, givens, solution } = puzzle;
    const { size, starsPerLine, cellCount } = grid;
    const problems: string[] = [];
    const lineStars = new Array<number>(size * 3).fill(0);
    const regionSizes = new Array<number>(size).fill(0);
    for (let cell = 0; cell < cellCount; cell++) {
        regionSizes[regions[cell]]++;
        if (solution[cell] !== STAR) continue;
        lineStars[Math.floor(cell / size)]++;
        lineStars[size + (cell % size)]++;
        lineStars[size * 2 + regions[cell]]++;
        for (let other = cell + 1; other < cellCount; other++) {
            if (solution[other] === STAR && grid.isTouching(cell, other)) problems.push(`stars ${cell} and ${other} touch`);
        }
        if (givens[cell] !== UNKNOWN && givens[cell] !== STAR) problems.push(`given at ${cell} isn't its star`);
    }
    if (lineStars.some((stars) => stars !== starsPerLine)) problems.push(`stars in lines: ${lineStars.join(',')}`);
    if (starsPerLine === 1 && regionSizes.includes(1)) problems.push('a one-cell region');
    if (countSolutions(grid, regions, givens, 2) !== 1) problems.push('not one solution');

    const solver = createStarSolver({ grid, regions });
    const solved = solver.solve(givens, settings.hardest);
    if (!solved.isFinished) problems.push('the techniques don\'t finish it');
    if (settings.isHardestNeeded && solved.hardest !== settings.hardest) problems.push(`needs ${solved.hardest}, not ${settings.hardest}`);
    const without = givens.slice();
    for (let cell = 0; cell < cellCount; cell++) {
        if (givens[cell] === UNKNOWN) continue;
        without[cell] = UNKNOWN;
        if (solver.solve(without, settings.hardest).isFinished) problems.push(`given at ${cell} isn't needed`);
        without[cell] = givens[cell];
    }
    return problems;
}
