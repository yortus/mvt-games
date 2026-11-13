import { describe, expect, it } from 'vitest';
import { checkGraderSteps } from './test-grids.test-support';

// Twelve puzzles, which take a second or more. logic-grader.test.ts checks two.
describe('the logic grader, on twelve puzzles', () => {
    it('never places a wrong digit, nor rubs out a right one, in puzzles of every level', () => {
        const { ambiguous, mistakes, usedTechniques } = checkGraderSteps([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        expect(ambiguous).toEqual([]);
        expect(mistakes).toEqual([]);
        // Enough puzzles to see more than singles, so the other techniques are checked too
        expect(usedTechniques.size).toBeGreaterThan(2);
    });
});
