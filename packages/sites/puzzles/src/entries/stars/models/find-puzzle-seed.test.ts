import { describe, expect, it } from 'vitest';
import { toDayNumber } from '../../../shared';
import { findPuzzleSeed } from './find-puzzle-seed';
import { LEVEL_SETTINGS, STAR_LEVELS } from './levels';
import { FIRST_DAY } from './model-constants';
import { describePuzzle } from './puzzle-save';
import { createStarPuzzle } from './star-puzzle';

describe('findPuzzleSeed', () => {
    // Every player gets the same puzzle on the same day, and their progress is
    // kept with its puzzle. These pin two days' puzzles, so that a change to
    // how puzzles are made can't change every day's puzzle without anyone
    // noticing. If this fails, the change would drop every player's progress.
    it('gives the same puzzles for the same days, for good', () => {
        const days = { 'the first day': FIRST_DAY, '30 October 2026': toDayNumber({ year: 2026, month: 10, day: 30 }) };
        const puzzles: Record<string, string> = {};
        for (const [name, day] of Object.entries(days)) {
            for (const level of STAR_LEVELS) {
                puzzles[`${name}, ${level}`] = describePuzzle(createStarPuzzle({ seed: findPuzzleSeed(day, level), settings: LEVEL_SETTINGS[level] }));
            }
        }
        expect(puzzles).toMatchInlineSnapshot(`
          {
            "30 October 2026, easy": "8x2 0001122200011222001112224451133345555366455566664555777755557777 0000000000000000000000000000010000000000000000000010000000000000",
            "30 October 2026, expert": "10x2 0001111113000221113300222113330225543334555544444455555444447758864666778886666977888999997777899999 1000002000002000000000000000002000000000000000000100000000000000000100000000000000000000000000000000",
            "30 October 2026, hard": "9x2 022221111022221111000444113004444133005444773055566773885666777888666777888667777 100020000000000000000000000000000000000000000000000000000000000000000000000000200",
            "30 October 2026, medium": "8x2 2000011122221111222344552223445522334455223347556666677766677777 0000000000000000000000000000000000000000000000000000000000000000",
            "the first day, easy": "8x2 2000111122331111223344512233445526334455666344556666777766667777 0000000000000000000100000000000000000000000010000010000000000000",
            "the first day, expert": "10x2 0000011111000111211100222221113355552444335555444633555566663388855766938888776699988887769999887776 2000000000000000000000100010000000000000000010000001000000000002000000000000000000000000000000000100",
            "the first day, hard": "9x2 222300011222333011223300011222334414225554444665655544666655777868666677888666677 000000000000000000000000000000000000000000000000000000000000000000010001000000000",
            "the first day, medium": "8x2 0000311122033111222333142233333422536644225566447775564477755664 0000000000000000000000000000000000000000000000000000000000000000",
          }
        `);
    });
});
