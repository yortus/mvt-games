import { describe, expect, it } from 'vitest';
import { createRandom } from '@mvtjs/site-kit/random';
import { EMPTY, STAR, UNKNOWN } from './cell-states';
import { growRegions } from './grow-regions';
import { layOutStars } from './lay-out-stars';
import { createStarGrid } from './star-grid';
import { createStarSolver, STAR_TECHNIQUES } from './star-solver';

// A technique that concluded something false would make the maker think a
// puzzle had one solution when it had more. So each technique, with the ones
// before it, is run on many grids from a part of a known solution, and must
// never contradict that solution. Grown regions often have other solutions
// too, which is the hard case: a sound technique concludes only what every
// solution shares.

describe('the solver\'s techniques', () => {
    it('never contradict a solution, and each one makes progress the ones before it can\'t', () => {
        const wrong: string[] = [];
        const progress = new Array<number>(STAR_TECHNIQUES.length).fill(0);
        for (const [size, starsPerLine] of SHAPES) {
            const grid = createStarGrid({ size, starsPerLine });
            const random = createRandom({ seed: size * 10 + starsPerLine });
            for (let sample = 0; sample < SAMPLES_PER_SHAPE; sample++) {
                const solution = layOutStars({ grid, random });
                const regions = growRegions({ grid, solution, random });
                if (regions === undefined) continue;
                const solver = createStarSolver({ grid, regions });
                // A few cells of the solution, as givens
                const givens = new Uint8Array(grid.cellCount).fill(UNKNOWN);
                for (let i = 0; i < size / 2; i++) {
                    const cell = random.nextIndex(grid.cellCount);
                    givens[cell] = solution[cell] === STAR ? STAR : EMPTY;
                }
                let knownBefore = -1;
                for (let t = 0; t < STAR_TECHNIQUES.length; t++) {
                    const { cells } = solver.solve(givens, STAR_TECHNIQUES[t]);
                    let known = 0;
                    for (let cell = 0; cell < grid.cellCount; cell++) {
                        if (cells[cell] === UNKNOWN) continue;
                        known++;
                        if ((cells[cell] === STAR) !== (solution[cell] === STAR)) wrong.push(`${size}x${starsPerLine} #${sample} ${STAR_TECHNIQUES[t]}: cell ${cell}`);
                    }
                    if (knownBefore >= 0 && known > knownBefore) progress[t]++;
                    knownBefore = known;
                }
            }
        }
        expect(wrong.slice(0, 10)).toEqual([]);
        expect(progress.slice(1).every((count) => count > 0)).toBe(true);
    }, 120_000);
});

const SHAPES: readonly (readonly [number, number])[] = [[6, 1], [8, 1], [9, 2], [10, 2]];
const SAMPLES_PER_SHAPE = 150;
