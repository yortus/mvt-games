import { describe, expect, it } from 'vitest';
import { LEVELS, loadSudokuGenerator } from '#sudoku-digger';
import { toDayNumber } from './day-numbers';
import { findPuzzleSeed } from './find-puzzle-seed';
import { FIRST_DAY } from './model-constants';

describe('findPuzzleSeed', () => {
    // Every player gets the same puzzle on the same day, and their progress is
    // kept with its givens. These pin the givens of two days' puzzles, so that
    // a change to how puzzles are made, here or in Sudoku Digger, can't change
    // every day's puzzle without anyone noticing.
    it('gives the same puzzles for the same days, for good', async () => {
        const generate = await loadSudokuGenerator();
        const days = { 'the first day': FIRST_DAY, '30 October 2026': toDayNumber({ year: 2026, month: 10, day: 30 }) };
        const givens: Record<string, string> = {};
        for (const [name, day] of Object.entries(days)) {
            for (const level of LEVELS) {
                givens[`${name}, ${level}`] = generate({ seed: findPuzzleSeed(day, level), level }).givens.join('');
            }
        }
        expect(givens).toMatchInlineSnapshot(`
          {
            "30 October 2026, easiest": "000149086208000471160807005913208600472960358586304000020690810600783009809410760",
            "30 October 2026, easy": "089400000302008600004090000900500300500607000207930005000019250100000039090306700",
            "30 October 2026, hard": "190500080400000310360140050010000000907380000053090600000000000289000000706020000",
            "30 October 2026, hardest": "000070023001002009080900500004010060105300000000000700073804000608000000000020000",
            "30 October 2026, medium": "009040100465008000080000000000400030700006000040170000050603000300000900601050002",
            "the first day, easiest": "090605074405283000010094350607501943032408500154000782741069805000152037500847019",
            "the first day, easy": "003010640000260000740300250015000700900800000004052009600090000402078030000000504",
            "the first day, hard": "000000000370000000502700000100450700860200010200130580600000050001800000400590200",
            "the first day, hardest": "000760000004802900002004100000000800900000012001006079040007000009300041320000080",
            "the first day, medium": "300000200800410000561000300400600000980100070630900000200000900700082500100000003",
          }
        `);
    });
});
