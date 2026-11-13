/** @jsxImportSource @mvtjs/pixi */

import { type Container, type FederatedPointerEvent, Rectangle } from 'pixi.js';
import { listenToPointer } from '@mvtjs/site-kit/input/pixi';
import { createComputed } from '@mvtjs/utils';
import { CALENDAR_SLOTS, type DailyCalendar } from '../models';
import { ButtonView } from './button-view';
import { DayView } from './day-view';
import {
    DAY_PITCH, DAYS_Y, DIM_TEXT_COLOR, FONT_FAMILY, FOOTER_Y, INK_COLOR, LABEL_STYLE, MARGIN, MONTH_BUTTON_WIDTH, MONTH_NAMES, MONTH_Y,
    PAGE_WIDTH, SCREEN_HEIGHT, SCREEN_WIDTH, SMALL_STYLE, TAB_GAP, TAB_HEIGHT, TAB_Y, TAGLINE_Y, TITLE_Y, WEEKDAY_NAMES, WEEKDAY_Y,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CalendarViewBindings<L extends string> {
    /** The calendar it shows. */
    calendar: DailyCalendar<L>;
    /** The game's name, across the top, and a line under it, read once. */
    title: string;
    tagline: string;
    /** Each level's name, as its tab gives it, read once. */
    levelNames: Readonly<Record<L, string>>;
    /** The player chose `day`, which has a puzzle to play. */
    onDayChosen: (day: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The calendar's screen: the game's name, a tab for each level, and a month
 * of days, each ticked once its puzzle at that level is solved. Days after
 * today, and before the first, are faded. The arrows go to the months
 * before and after, as far as there are puzzles, and so does a swipe
 * anywhere on the screen: to the left for the month after, as a page turns,
 * and to the right for the month before. Its origin is the screen's top left
 * corner.
 */
export function CalendarView<L extends string>(bindings: CalendarViewBindings<L>): Container {
    const { calendar, levelNames } = bindings;
    const middleX = MARGIN + PAGE_WIDTH / 2;
    const tabWidth = (PAGE_WIDTH - TAB_GAP * (calendar.levels.length - 1)) / calendar.levels.length;
    const monthText = createComputed({
        watch: { year: () => calendar.shownYear, month: () => calendar.shownMonth },
        compute: ({ year, month }) => `${MONTH_NAMES[month - 1]} ${year}`,
    });
    const footerText = createComputed({
        watch: { count: () => calendar.solvedCount, level: () => calendar.level },
        compute: ({ count, level }) => writeFooter(count, levelNames[level]),
    });
    const tabs = calendar.levels.map((level, i) => (
        <ButtonView
            x={MARGIN + i * (tabWidth + TAB_GAP)}
            y={TAB_Y}
            width={tabWidth}
            height={TAB_HEIGHT}
            label={levelNames[level]}
            isLit={() => calendar.level === level}
            onPressed={() => calendar.chooseLevel(level)}
        />
    ));
    const weekdays = WEEKDAY_NAMES.map((name, i) => (
        <text text={name.slice(0, 3)} x={MARGIN + (i + 0.5) * DAY_PITCH} y={WEEKDAY_Y} anchor={0.5} style={SMALL_STYLE} tint={DIM_TEXT_COLOR} />
    ));
    const days = Array.from({ length: CALENDAR_SLOTS }, (_, slot) => {
        const day = (): number => calendar.dayInSlot(slot);
        return (
            <DayView
                x={MARGIN + (slot % 7) * DAY_PITCH + 3}
                y={DAYS_Y + Math.floor(slot / 7) * DAY_PITCH + 3}
                day={day}
                isToday={() => day() === calendar.today}
                isPlayable={() => calendar.isPlayable(day())}
                isSolved={() => calendar.isSolved(day())}
                isStarted={() => calendar.isStarted(day())}
                onPressed={bindings.onDayChosen}
            />
        );
    });
    return (
        <container ref={(view) => listenToSwipes(view, calendar)}>
            <text text={bindings.title} x={middleX} y={TITLE_Y} anchor={0.5} style={TITLE_STYLE} tint={INK_COLOR} />
            <text text={bindings.tagline} x={middleX} y={TAGLINE_Y} anchor={0.5} style={SMALL_STYLE} tint={DIM_TEXT_COLOR} />
            {tabs}
            <ButtonView
                x={MARGIN}
                y={MONTH_Y}
                width={MONTH_BUTTON_WIDTH}
                height={TAB_HEIGHT}
                label="‹"
                labelSize={26}
                isEnabled={() => calendar.canShowEarlierMonth}
                onPressed={calendar.showEarlierMonth}
            />
            <text text={monthText} x={middleX} y={MONTH_Y + TAB_HEIGHT / 2} anchor={0.5} style={MONTH_STYLE} tint={INK_COLOR} />
            <ButtonView
                x={MARGIN + PAGE_WIDTH - MONTH_BUTTON_WIDTH}
                y={MONTH_Y}
                width={MONTH_BUTTON_WIDTH}
                height={TAB_HEIGHT}
                label="›"
                labelSize={26}
                isEnabled={() => calendar.canShowLaterMonth}
                onPressed={calendar.showLaterMonth}
            />
            {weekdays}
            {days}
            <text text={footerText} x={middleX} y={FOOTER_Y} anchor={0.5} style={SMALL_STYLE} tint={DIM_TEXT_COLOR} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TITLE_STYLE = { fontFamily: FONT_FAMILY, fontSize: 34, fontWeight: '700', fill: 0xffffff };
const MONTH_STYLE = { ...LABEL_STYLE, fontSize: 21 };
/** How far a finger must slide, in the screen's pixels, to swipe rather than tap. */
const SWIPE_DISTANCE = 40;

/**
 * Turns a swipe over `view`, mostly across, into a change of month. A swipe
 * starts on a day or a button as often as on the paper, so `view` listens
 * over the whole screen, and hears presses on its children too, since they
 * pass up to it. A press that slides isn't a tap, even one let go on the day
 * it began on, so its tap is stopped on its way down to the day.
 */
function listenToSwipes<L extends string>(view: Container, calendar: DailyCalendar<L>): void {
    view.hitArea = new Rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    // Where the press landed
    let startX = 0;
    let startY = 0;
    // Whether the press has slid far enough to swipe. It stays set until the next press, for its tap, which comes after it is let go
    let hasSlid = false;
    listenToPointer({
        target: view,
        onPressed(x, y) {
            startX = x;
            startY = y;
            hasSlid = false;
        },
        onMoved: follow,
        // A quick flick may slide its whole way between two moves
        onReleased: follow,
    });
    view.on('pointertapcapture', (e: FederatedPointerEvent) => {
        if (hasSlid) e.stopPropagation();
    });

    /** Notes the press at (`x`, `y`), and swipes once it has slid far enough, if mostly across. */
    function follow(x: number, y: number): void {
        if (hasSlid) return;
        const dx = x - startX;
        const dy = y - startY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return;
        hasSlid = true;
        if (Math.abs(dx) <= Math.abs(dy)) return;
        if (dx < 0) calendar.showLaterMonth();
        else calendar.showEarlierMonth();
    }
}

function writeFooter(count: number, levelName: string): string {
    if (count === 0) return `No puzzles solved at ${levelName} yet`;
    return `${count} ${count === 1 ? 'puzzle' : 'puzzles'} solved at ${levelName}`;
}
