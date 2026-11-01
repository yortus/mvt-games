import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '@mvtjs/site-kit/storage';
import { CALENDAR_SLOTS, createDailyCalendar, type DailyCalendar } from './daily-calendar';
import { createDailyRecords, type DailyRecords } from './daily-records';
import { toDayNumber } from './day-numbers';

// Today is Friday 30 October 2026 in every test, unless a test says otherwise.

const TODAY = toDayNumber({ year: 2026, month: 10, day: 30 });
const FIRST_DAY = toDayNumber({ year: 2026, month: 1, day: 1 });
const LEVELS = ['easy', 'hard'] as const;
type TestLevel = (typeof LEVELS)[number];

describe('DailyCalendar', () => {
    it('starts at this month, with October 2026 laid out from Monday the 28th of September', () => {
        const { calendar } = createCalendar();
        expect([calendar.shownYear, calendar.shownMonth]).toEqual([2026, 10]);
        expect(calendar.level).toBe('easy');
        // October 2026 starts on a Thursday, the fourth slot
        expect(calendar.dayInSlot(2)).toBe(-1);
        expect(calendar.dayInSlot(3)).toBe(toDayNumber({ year: 2026, month: 10, day: 1 }));
        expect(calendar.dayInSlot(3 + 30)).toBe(toDayNumber({ year: 2026, month: 10, day: 31 }));
        expect(calendar.dayInSlot(3 + 31)).toBe(-1);
        expect(calendar.dayInSlot(CALENDAR_SLOTS - 1)).toBe(-1);
    });

    it('goes back no earlier than the first day\'s month, and on no later than this month', () => {
        const { calendar } = createCalendar();
        expect(calendar.canShowLaterMonth).toBe(false);
        calendar.showLaterMonth();
        expect(calendar.shownMonth).toBe(10);
        for (let i = 0; i < 20; i++) calendar.showEarlierMonth();
        expect([calendar.shownYear, calendar.shownMonth]).toEqual([2026, 1]);
        expect(calendar.canShowEarlierMonth).toBe(false);
        calendar.showLaterMonth();
        expect(calendar.shownMonth).toBe(2);
    });

    it('crosses into a new year, a month at a time', () => {
        const { calendar } = createCalendar(toDayNumber({ year: 2027, month: 1, day: 3 }));
        calendar.showEarlierMonth();
        expect([calendar.shownYear, calendar.shownMonth]).toEqual([2026, 12]);
        calendar.showLaterMonth();
        expect([calendar.shownYear, calendar.shownMonth]).toEqual([2027, 1]);
    });

    it('has puzzles from the first day to today, but none before or after', () => {
        const { calendar } = createCalendar();
        expect([FIRST_DAY - 1, FIRST_DAY, TODAY, TODAY + 1].map(calendar.isPlayable)).toEqual([false, true, true, false]);
    });

    it('shows what is solved and started at the level chosen, and starts at the level chosen last', () => {
        const store = createMemoryStore();
        const { calendar, records } = createCalendar(TODAY, store);
        records.markSolved(TODAY, 'hard');
        records.writePuzzle(TODAY - 1, 'hard', {});
        expect(calendar.isSolved(TODAY)).toBe(false);
        expect(calendar.solvedCount).toBe(0);
        calendar.chooseLevel('hard');
        expect(calendar.isSolved(TODAY)).toBe(true);
        expect(calendar.isStarted(TODAY - 1)).toBe(true);
        expect(calendar.isSolved(TODAY - 1)).toBe(false);
        expect(calendar.solvedCount).toBe(1);

        expect(createCalendar(TODAY, store).calendar.level).toBe('hard');
    });
});

function createCalendar(today = TODAY, store = createMemoryStore()): { calendar: DailyCalendar<TestLevel>; records: DailyRecords<TestLevel> } {
    const records = createDailyRecords({ store, gameId: 'test', levels: LEVELS });
    return { calendar: createDailyCalendar({ today, firstDay: FIRST_DAY, levels: LEVELS, startingLevel: 'easy', records }), records };
}
