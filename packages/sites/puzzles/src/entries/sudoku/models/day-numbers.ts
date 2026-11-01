// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// A day is numbered by its date, from 1 January 1970, day 0, wherever in the
// world it is that date.
// A number is easy to count with and to compare, and turns into a date only
// to be shown. The conversions are Howard Hinnant's, which need no `Date`.

/** A date on the calendar. Its month runs from 1, January, to 12. */
export interface CalendarDate {
    readonly year: number;
    readonly month: number;
    readonly day: number;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Returns the number of the day on `date`. */
export function toDayNumber(date: CalendarDate): number {
    const year = date.month <= 2 ? date.year - 1 : date.year;
    const era = Math.floor(year / 400);
    const yearOfEra = year - era * 400;
    const dayOfYear = Math.floor((153 * (date.month + (date.month > 2 ? -3 : 9)) + 2) / 5) + date.day - 1;
    const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
    return era * 146_097 + dayOfEra - 719_468;
}

/** Returns the date of the day numbered `dayNumber`. */
export function toCalendarDate(dayNumber: number): CalendarDate {
    const z = dayNumber + 719_468;
    const era = Math.floor(z / 146_097);
    const dayOfEra = z - era * 146_097;
    const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36_524) - Math.floor(dayOfEra / 146_096)) / 365);
    const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
    const shiftedMonth = Math.floor((5 * dayOfYear + 2) / 153);
    const month = shiftedMonth < 10 ? shiftedMonth + 3 : shiftedMonth - 9;
    const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
    return { year, month, day: dayOfYear - Math.floor((153 * shiftedMonth + 2) / 5) + 1 };
}

/** Returns the day of the week of the day numbered `dayNumber`, from 0 for Monday to 6 for Sunday. */
export function findWeekday(dayNumber: number): number {
    // Day 0, 1 January 1970, was a Thursday
    return (((dayNumber + 3) % 7) + 7) % 7;
}

/** Returns how many days `month` of `year` has. */
export function countDaysInMonth(year: number, month: number): number {
    const next = month === 12 ? { year: year + 1, month: 1, day: 1 } : { year, month: month + 1, day: 1 };
    return toDayNumber(next) - toDayNumber({ year, month, day: 1 });
}
