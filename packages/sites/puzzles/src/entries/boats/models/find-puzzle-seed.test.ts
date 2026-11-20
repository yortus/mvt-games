import { describe, expect, it } from 'vitest';
import { toDayNumber } from '../../../shared';
import { findPuzzleSeed } from './find-puzzle-seed';
import { LEVEL_SETTINGS, BOAT_LEVELS } from './levels';
import { FIRST_DAY } from './model-constants';
import { describePuzzle } from './puzzle-save';
import { createBoatPuzzle } from './boat-puzzle';

describe('findPuzzleSeed', () => {
    // Every player gets the same puzzle on the same day, and their progress is
    // kept with its puzzle. These pin two days' puzzles, so that a change to
    // how puzzles are made can't change every day's puzzle without anyone
    // noticing. If this fails, the change would drop every player's progress.
    it('gives the same puzzles for the same days, for good', () => {
        const days = { 'the first day': FIRST_DAY, '30 October 2026': toDayNumber({ year: 2026, month: 10, day: 30 }) };
        const puzzles: Record<string, string> = {};
        for (const [name, day] of Object.entries(days)) {
            for (const level of BOAT_LEVELS) {
                puzzles[`${name}, ${level}`] = describePuzzle(createBoatPuzzle({ seed: findPuzzleSeed(day, level), settings: LEVEL_SETTINGS[level] }));
            }
        }
        expect(puzzles).toMatchInlineSnapshot(`
          {
            "30 October 2026, easy": "6 322111 0.4.1.1.2.2 3.0.1.2.0.4 000000000000000000000003000000000000",
            "30 October 2026, expert": "10 4332221111 0.4.2.2.0.1.2.5.1.3 2.2.2.1.2.4.2.0.5.0 0000000000200005000000000000300000000000000000000000000000000000000000040000000000000000002000000000",
            "30 October 2026, hard": "10 4332221111 0.4.1.0.6.1.0.3.1.4 1.1.1.1.3.3.2.4.0.4 0000000000000040000000000000000000000000060000700000000000000000000000000200000200000000000020000300",
            "30 October 2026, medium": "8 4322111 1.3.1.5.1.0.3.0 2.2.2.0.4.0.0.4 0000000001000000000000010000000000003000000000001000000000000000",
            "the first day, easy": "6 322111 1.2.2.1.3.1 3.1.1.2.3.0 000000000000000000200000000000000000",
            "the first day, expert": "10 4332221111 2.2.0.1.2.3.0.4.1.5 0.4.3.2.2.3.0.1.2.3 0020000000000006000000000000000000000000000000000000000004060000000000000700000000000000000000000000",
            "the first day, hard": "10 4332221111 3.1.4.0.4.1.5.0.1.1 1.3.3.3.3.1.3.0.1.2 0400000000000000300000000000000000000000007000000000000000030000000000000000000000000000000200000000",
            "the first day, medium": "8 4322111 2.0.3.1.1.3.0.4 2.2.2.3.2.0.0.3 0000000000000000200020000000000000000000020000010000000000000000",
          }
        `);
    });
});
