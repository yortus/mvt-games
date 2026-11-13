import { describe, expect, it } from 'vitest';
import type { Level } from '../sudoku-grid';
import { createDiggerModel } from './digger-model';
import { TECHNIQUE_LEVEL } from './model-constants';

// Five puzzles, which take most of a second. digger-model.test.ts grades one.
describe('the digger model, on five hardest puzzles', () => {
    it('grades a finished puzzle by the hardest technique it needed, or Hardest if it needed guesswork', () => {
        for (let seed = 41; seed < 46; seed++) {
            const model = createDiggerModel({ seed, level: 'hardest' });
            model.choosePlayback('fast');
            while (model.phase !== 'finished') model.update(1000);
            const technique = model.grading.hardestTechnique;
            const expected: Level = model.grading.needsGuessing ? 'hardest' : technique === undefined ? 'easiest' : TECHNIQUE_LEVEL[technique];
            expect(model.grade, `seed ${seed}`).toBe(expected);
        }
    });
});
