import { findWeekday, toCalendarDate } from '../models';
import { MONTH_NAMES, WEEKDAY_NAMES } from './view-constants';

/** Returns the date of `day` written out in full, such as "Friday 30 October 2026", for a puzzle's title. */
export function writeDate(day: number): string {
    const { year, month, day: dayOfMonth } = toCalendarDate(day);
    return `${WEEKDAY_NAMES[findWeekday(day)]} ${dayOfMonth} ${MONTH_NAMES[month - 1]} ${year}`;
}
