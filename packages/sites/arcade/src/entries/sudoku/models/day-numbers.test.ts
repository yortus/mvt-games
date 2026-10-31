import { describe, expect, it } from 'vitest';
import { countDaysInMonth, findWeekday, toCalendarDate, toDayNumber } from './day-numbers';

describe('day numbers', () => {
    it('counts days from 1 January 1970, as JavaScript\'s dates do at UTC', () => {
        expect(toDayNumber({ year: 1970, month: 1, day: 1 })).toBe(0);
        const dates = ['1999-12-31', '2000-02-29', '2024-02-29', '2026-01-01', '2026-10-30', '2100-03-01'];
        for (const text of dates) {
            const [year, month, day] = text.split('-').map(Number);
            expect(toDayNumber({ year, month, day })).toBe(Date.parse(text) / MS_PER_DAY);
        }
    });

    it('turns every day number back into its date, over centuries', () => {
        for (let dayNumber = -1000; dayNumber < 60_000; dayNumber += 7) {
            const date = new Date(dayNumber * MS_PER_DAY);
            const expected = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
            expect(toCalendarDate(dayNumber)).toEqual(expected);
            expect(toDayNumber(expected)).toBe(dayNumber);
        }
    });

    it('finds the day of the week, with Monday first', () => {
        // 30 October 2026 is a Friday, and 1 January 1970 a Thursday
        expect(findWeekday(toDayNumber({ year: 2026, month: 10, day: 30 }))).toBe(4);
        expect(findWeekday(0)).toBe(3);
        expect(findWeekday(-3)).toBe(0);
    });

    it('counts the days in a month, leap years and all', () => {
        expect(countDaysInMonth(2026, 1)).toBe(31);
        expect(countDaysInMonth(2026, 2)).toBe(28);
        expect(countDaysInMonth(2028, 2)).toBe(29);
        expect(countDaysInMonth(2100, 2)).toBe(28);
        expect(countDaysInMonth(2026, 12)).toBe(31);
        expect(countDaysInMonth(2026, 11)).toBe(30);
    });
});

const MS_PER_DAY = 86_400_000;
