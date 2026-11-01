import type { DailyRecords } from './daily-records';
import { countDaysInMonth, findWeekday, toCalendarDate, toDayNumber } from './day-numbers';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The calendar of a daily puzzle game: a page for a month, a tab for each
 * level, and which days' puzzles at that level are solved and started. Any
 * day from the first to today can be played, but no day after today. Days
 * are numbered from 1 January 1970.
 */
export interface DailyCalendar<L extends string> {
    /** Today, where the player is: the last day with a puzzle. */
    readonly today: number;
    /** The game's levels, in order, a tab for each. */
    readonly levels: readonly L[];
    /** The level the calendar shows, and the puzzles it opens are at. */
    readonly level: L;
    /** The month the calendar shows. Its month runs from 1 to 12. */
    readonly shownYear: number;
    readonly shownMonth: number;
    /** Whether the calendar can go back a month, or on one. It goes no earlier than the first day's month, nor later than today's. */
    readonly canShowEarlierMonth: boolean;
    readonly canShowLaterMonth: boolean;
    /** The day in slot `slot` of the month's page, six weeks of seven from a Monday, or -1 for a slot outside the month. */
    readonly dayInSlot: (slot: number) => number;
    /** Whether `day` has a puzzle to play: it is no earlier than the first day, and no later than today. */
    readonly isPlayable: (day: number) => boolean;
    /** Whether `day`'s puzzle at the chosen level is solved, or started. */
    readonly isSolved: (day: number) => boolean;
    readonly isStarted: (day: number) => boolean;
    /** How many days' puzzles are solved at the chosen level. */
    readonly solvedCount: number;

    chooseLevel: (level: L) => void;
    showEarlierMonth: () => void;
    showLaterMonth: () => void;
}

/** The days a month's page shows: six weeks of seven, Monday first, with the month somewhere among them. */
export const CALENDAR_SLOTS = 42;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DailyCalendarOptions<L extends string> {
    /** Today's date where the player is, numbered from 1 January 1970. The page reads the clock, and the model takes the day it gives. */
    readonly today: number;
    /** The first day with puzzles. The calendar goes back no further. */
    readonly firstDay: number;
    readonly levels: readonly L[];
    /** The level a new player starts on. After that, the level they last chose. */
    readonly startingLevel: L;
    /** What the player has solved and started, and the level they chose last. */
    readonly records: DailyRecords<L>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the calendar at this month, at the level chosen last. */
export function createDailyCalendar<L extends string>(options: DailyCalendarOptions<L>): DailyCalendar<L> {
    const { today, firstDay, levels, records } = options;
    const todayDate = toCalendarDate(today);
    const firstDate = toCalendarDate(firstDay);

    let level = records.chosenLevel ?? options.startingLevel;
    let shownYear = todayDate.year;
    let shownMonth = todayDate.month;
    // The shown month's first day, the slot it is in, and how many days it has
    let monthStart = 0;
    let firstSlot = 0;
    let monthLength = 0;
    findMonth();

    const calendar: DailyCalendar<L> = {
        today,
        levels,
        get level() { return level; },
        get shownYear() { return shownYear; },
        get shownMonth() { return shownMonth; },
        get canShowEarlierMonth() { return shownYear * 12 + shownMonth > firstDate.year * 12 + firstDate.month; },
        get canShowLaterMonth() { return shownYear * 12 + shownMonth < todayDate.year * 12 + todayDate.month; },
        dayInSlot: (slot) => (slot < firstSlot || slot >= firstSlot + monthLength ? -1 : monthStart + slot - firstSlot),
        isPlayable: (day) => day >= firstDay && day <= today,
        isSolved: (day) => records.isSolved(day, level),
        isStarted: (day) => records.isStarted(day, level),
        get solvedCount() { return records.countSolved(level); },
        chooseLevel(next) {
            if (next === level) return;
            level = next;
            records.rememberLevel(next);
        },
        showEarlierMonth() {
            if (!calendar.canShowEarlierMonth) return;
            shownYear = shownMonth === 1 ? shownYear - 1 : shownYear;
            shownMonth = shownMonth === 1 ? 12 : shownMonth - 1;
            findMonth();
        },
        showLaterMonth() {
            if (!calendar.canShowLaterMonth) return;
            shownYear = shownMonth === 12 ? shownYear + 1 : shownYear;
            shownMonth = shownMonth === 12 ? 1 : shownMonth + 1;
            findMonth();
        },
    };
    return calendar;

    function findMonth(): void {
        monthStart = toDayNumber({ year: shownYear, month: shownMonth, day: 1 });
        firstSlot = findWeekday(monthStart);
        monthLength = countDaysInMonth(shownYear, shownMonth);
    }
}
