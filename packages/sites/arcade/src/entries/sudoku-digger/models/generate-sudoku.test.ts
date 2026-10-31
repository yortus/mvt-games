import { describe, expect, it } from 'vitest';
import { LEVELS } from '../sudoku-grid';
import { generateSudoku } from './generate-sudoku';
import { countSolutions, isValidGrid } from './test-grids.test-support';

describe('generateSudoku', () => {
    it('makes the same puzzle from the same seed and level', () => {
        const first = generateSudoku({ seed: 7, level: 'medium' });
        const again = generateSudoku({ seed: 7, level: 'medium' });
        expect(again).toEqual(first);
        expect(generateSudoku({ seed: 8, level: 'medium' }).givens).not.toEqual(first.givens);
    });

    for (const level of LEVELS) {
        it(`makes ${level} puzzles with one solution, that come out at ${level}`, () => {
            for (let seed = 0; seed < 4; seed++) {
                const { givens, solution, grade } = generateSudoku({ seed, level });
                expect(isValidGrid(Uint8Array.from(solution))).toBe(true);
                expect(givens.every((digit, cell) => digit === 0 || digit === solution[cell])).toBe(true);
                expect(countSolutions(Uint8Array.from(givens))).toBe(1);
                expect(grade).toBe(level);
            }
        });
    }
});
