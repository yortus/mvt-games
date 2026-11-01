import { describe, expect, it } from 'vitest';
import { PUZZLE_LEVELS, toDayNumber } from '../../../shared';
import { findPuzzleSeed } from './find-puzzle-seed';
import { LEVEL_SETTINGS } from './levels';
import { makeMazePuzzle } from './make-maze-puzzle';
import { FIRST_DAY } from './model-constants';
import { describeMaze } from './puzzle-save';

describe('findPuzzleSeed', () => {
    // Every player gets the same puzzle on the same day, and their progress is
    // kept with its maze. These pin two days' mazes, so that a change to how
    // mazes are made can't change every day's puzzle without anyone noticing.
    it('gives the same puzzles for the same days, for good', () => {
        const days = { 'the first day': FIRST_DAY, '30 October 2026': toDayNumber({ year: 2026, month: 10, day: 30 }) };
        const mazes: Record<string, string> = {};
        for (const [name, day] of Object.entries(days)) {
            for (const level of PUZZLE_LEVELS) {
                mazes[`${name}, ${level}`] = describeMaze(makeMazePuzzle({ seed: findPuzzleSeed(day, level), settings: LEVEL_SETTINGS[level] }));
            }
        }
        expect(mazes).toMatchInlineSnapshot(`
          {
            "30 October 2026, easy": "5x5 10-14 2/2/1.1/2/3/1/1.2/1",
            "30 October 2026, expert": "11x11 4-100 1.6/1.2.5/1.1/5.1/1.8/9/7/3.2/1.1.1/1.3.1/2/2.2.2/1.1.2/2.2/2.2/2.2/2/2.2/2.2/3.2",
            "30 October 2026, hard": "9x9 18-46 1.3/3.2/5/1.2/1/5/2.1.2/3.2/1.2/1.2/2/2.2/4.2/5/1.2/5",
            "30 October 2026, medium": "7x7 12-8 1.2/2/2/2/4.2/1.2/3/3/2.1/2.1/3/3",
            "the first day, easy": "5x5 22-12 3/1/3/3/3/1/2/",
            "the first day, expert": "11x11 90-0 1.1.4/2.4/5/2.1/1/2.3/2.2.1/1.2/2.1/4.1/3.3/2.3.3/6/2.2/2.2.2/4/6/2.2/3.2/9",
            "the first day, hard": "9x9 50-74 2.1/2.2.1/4/2.2/2.2.2/3/3.2/5/1.2/1.2/5/1.2/3/2.4/2.1.1/2",
            "the first day, medium": "7x7 22-42 3.1/1/2.3/1/1/5/1.2/3/5/4/2.2/",
          }
        `);
    });
});
