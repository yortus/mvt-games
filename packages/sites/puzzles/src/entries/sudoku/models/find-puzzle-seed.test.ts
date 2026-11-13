import { describe, expect, it } from 'vitest';
import { PUZZLE_LEVELS } from '../../../shared';
import { loadSudokuGenerator } from '../generator';
import { findPuzzleSeed } from './find-puzzle-seed';
import { FIRST_DAY, GENERATOR_LEVELS } from './model-constants';

describe('findPuzzleSeed', () => {
    // Every player gets the same puzzle on the same day, and their progress is
    // kept with its givens. These pin the givens of one day's puzzles, so that
    // a change to how puzzles are made, here or in Sudoku Digger, can't change
    // every day's puzzle without anyone noticing. Such a change would change
    // every day, so one day is enough, and each puzzle takes a while to make.
    it('gives the same puzzles for the first day, for good', async () => {
        const generate = await loadSudokuGenerator();
        const givens: Record<string, string> = {};
        for (const level of PUZZLE_LEVELS) {
            givens[level] = generate({ seed: findPuzzleSeed(FIRST_DAY, level), level: GENERATOR_LEVELS[level] }).givens.join('');
        }
        expect(givens).toMatchInlineSnapshot(`
          {
            "easy": "003010640000260000740300250015000700900800000004052009600090000402078030000000504",
            "expert": "000760000004802900002004100000000800900000012001006079040007000009300041320000080",
            "hard": "000000000370000000502700000100450700860200010200130580600000050001800000400590200",
            "medium": "300000200800410000561000300400600000980100070630900000200000900700082500100000003",
          }
        `);
    });
});
