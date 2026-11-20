import { describe, expect, it } from 'vitest';
import { toDayNumber } from '../../../shared';
import { findPuzzleSeed } from './find-puzzle-seed';
import { LEVEL_SETTINGS, RIVER_LEVELS } from './levels';
import { FIRST_DAY } from './model-constants';
import { describePuzzle } from './puzzle-save';
import { createRiverPuzzle } from './river-puzzle';

describe('findPuzzleSeed', () => {
    // Every player gets the same puzzle on the same day, and their progress is
    // kept with its puzzle. These pin two days' puzzles, so that a change to
    // how puzzles are made can't change every day's puzzle without anyone
    // noticing. If this fails, the change would drop every player's progress.
    it('gives the same puzzles for the same days, for good', () => {
        const days = { 'the first day': FIRST_DAY, '30 October 2026': toDayNumber({ year: 2026, month: 10, day: 30 }) };
        const puzzles: Record<string, string> = {};
        for (const [name, day] of Object.entries(days)) {
            for (const level of RIVER_LEVELS) {
                puzzles[`${name}, ${level}`] = describePuzzle(createRiverPuzzle({ seed: findPuzzleSeed(day, level), settings: LEVEL_SETTINGS[level] }));
            }
        }
        expect(puzzles).toMatchInlineSnapshot(`
          {
            "30 October 2026, easy": "6 12.34 0.2.4.3.5.2 3.4.2.3.2.2 000000000000050000000000300000000000",
            "30 October 2026, expert": "10 10.97 7.8.8.8.7.5.4.3.4.2 3.3.6.5.3.5.9.10.9.3 0g00000000000000600000003000000000009000000900060000000000000000000000000000000000000000600000000000",
            "30 October 2026, hard": "8 16.58 0.0.3.6.6.6.6.3 2.4.6.6.5.4.3.0 000000000000000000000000000000000000000000a0a0000000000000000000",
            "30 October 2026, medium": "8 24.57 0.0.2.7.7.6.7.5 4.5.5.2.5.5.5.3 00000000000000000000000000000000090000600000000000a000000000a000",
            "the first day, easy": "6 30.35 0.0.2.5.6.5 4.4.2.2.3.3 000000000000000000000000500000000000",
            "the first day, expert": "10 0.95 5.5.3.1.5.5.4.5.5.5 7.7.9.8.7.3.2.0.0.0 0a000000000000000000000000000000000000000000000000000a00000000000000000300000000gg000000000000000000",
            "the first day, hard": "8 24.59 0.0.0.5.5.5.8.7 4.4.2.3.5.5.5.2 000000000000000000000000000000006000000000000000000000000000a000",
            "the first day, medium": "8 8.60 2.3.3.5.4.4.4.2 5.7.7.5.3.0.0.0 00000000a000000000000000000000000000000000a0000030a0000000000000",
          }
        `);
    });
});
