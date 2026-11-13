import { describe, expect, it } from 'vitest';
import { STAR, STARS_PER_LINE } from './cell-states';
import { LEVEL_SETTINGS, STAR_LEVELS } from './levels';
import { createStarPuzzle, type StarPuzzle } from './star-puzzle';
import { createStarSolver } from './star-solver';

describe('createStarPuzzle', () => {
    it('makes puzzles whose solution keeps every rule, with one solution, at the reasoning asked for', () => {
        const problems: string[] = [];
        for (let i = 0; i < STAR_LEVELS.length; i++) {
            const settings = LEVEL_SETTINGS[STAR_LEVELS[i]]!;
            for (let seed = 0; seed < SEEDS_PER_LEVEL; seed++) {
                const puzzle = createStarPuzzle({ seed, settings });
                const solver = createStarSolver({ grid: puzzle.grid, regions: puzzle.regions });
                const broken = findBrokenRule(puzzle);
                if (broken !== undefined) problems.push(`${STAR_LEVELS[i]} ${seed}: ${broken}`);
                if (solver.countSolutions(2) !== 1) problems.push(`${STAR_LEVELS[i]} ${seed}: not one solution`);
                if (puzzle.reasoning !== settings.reasoning) problems.push(`${STAR_LEVELS[i]} ${seed}: ${puzzle.reasoning}`);
            }
        }
        expect(problems).toEqual([]);
    });

    it('makes the same puzzle from the same seed', () => {
        const settings = LEVEL_SETTINGS.easy!;
        expect(createStarPuzzle({ seed: 3, settings }).regions).toEqual(createStarPuzzle({ seed: 3, settings }).regions);
    });
});

/** How many seeds each level is checked with: a sample, to keep within the test's time. */
const SEEDS_PER_LEVEL = 2;

/** Returns the first rule `puzzle`'s solution breaks, or undefined if it keeps them all: its regions are whole, and every line has two stars, none touching. */
function findBrokenRule(puzzle: StarPuzzle): string | undefined {
    const { grid, regions, solution } = puzzle;
    const { size, cellCount } = grid;
    const rowStars = new Array<number>(size).fill(0);
    const colStars = new Array<number>(size).fill(0);
    const regionStars = new Array<number>(size).fill(0);
    for (let cell = 0; cell < cellCount; cell++) {
        if (solution[cell] !== STAR) continue;
        rowStars[Math.floor(cell / size)]++;
        colStars[cell % size]++;
        regionStars[regions[cell]]++;
        for (let other = cell + 1; other < cellCount; other++) {
            if (solution[other] === STAR && grid.isTouching(cell, other)) return `stars ${cell} and ${other} touch`;
        }
    }
    const lines = [...rowStars, ...colStars, ...regionStars];
    if (lines.some((stars) => stars !== STARS_PER_LINE)) return `stars in lines: ${lines.join(',')}`;
    return undefined;
}
