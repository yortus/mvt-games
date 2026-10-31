/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import { LEVELS } from '#sudoku-digger';
import { CALENDAR_SLOTS } from '../data';
import type { SudokuModel } from '../models';
import { ButtonView } from './button-view';
import { DayView } from './day-view';
import {
    DAY_PITCH, DAYS_Y, DIM_TEXT_COLOR, FONT_FAMILY, FOOTER_Y, GRID_SIZE, INK_COLOR, LABEL_STYLE, LEVEL_NAMES, MARGIN,
    MONTH_BUTTON_WIDTH, MONTH_NAMES, MONTH_Y, SCREEN_WIDTH, SMALL_STYLE, TAB_GAP, TAB_HEIGHT, TAB_WIDTH, TAB_Y, TAGLINE_Y,
    TITLE_Y, WEEKDAY_NAMES, WEEKDAY_Y,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CalendarViewBindings {
    model: SudokuModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The calendar's screen: a tab for each level, and a month of days, each
 * ticked once its puzzle at that level is solved. Days after today, and
 * before the first, are faded. The arrows go to the months before and
 * after, as far as there are puzzles.
 */
export function CalendarView(bindings: CalendarViewBindings): Container {
    const { model } = bindings;
    const monthText = createComputed({
        watch: { year: () => model.shownYear, month: () => model.shownMonth },
        compute: ({ year, month }) => `${MONTH_NAMES[month - 1]} ${year}`,
    });
    const footerText = createComputed({
        watch: { count: () => model.solvedCount, level: () => model.level },
        compute: ({ count, level }) => writeFooter(count, LEVEL_NAMES[level]),
    });
    const tabs = LEVELS.map((level, i) => (
        <ButtonView
            x={MARGIN + i * (TAB_WIDTH + TAB_GAP)}
            y={TAB_Y}
            width={TAB_WIDTH}
            height={TAB_HEIGHT}
            label={LEVEL_NAMES[level]}
            isLit={() => model.level === level}
            onPressed={() => model.chooseLevel(level)}
        />
    ));
    const weekdays = WEEKDAY_NAMES.map((name, i) => (
        <text text={name.slice(0, 3)} x={MARGIN + (i + 0.5) * DAY_PITCH} y={WEEKDAY_Y} anchor={0.5} style={SMALL_STYLE} tint={DIM_TEXT_COLOR} />
    ));
    const days = Array.from({ length: CALENDAR_SLOTS }, (_, slot) => {
        const day = (): number => model.dayInSlot(slot);
        return (
            <DayView
                x={MARGIN + (slot % 7) * DAY_PITCH + 3}
                y={DAYS_Y + Math.floor(slot / 7) * DAY_PITCH + 3}
                day={day}
                isToday={() => day() === model.today}
                isPlayable={() => model.isPlayable(day())}
                isSolved={() => model.isSolved(day())}
                isStarted={() => model.isStarted(day())}
                onPressed={model.openPuzzle}
            />
        );
    });
    return (
        <container>
            <text text="Sudoku" x={SCREEN_WIDTH / 2} y={TITLE_Y} anchor={0.5} style={TITLE_STYLE} tint={INK_COLOR} />
            <text text="A new puzzle every day, at five levels" x={SCREEN_WIDTH / 2} y={TAGLINE_Y} anchor={0.5} style={SMALL_STYLE} tint={DIM_TEXT_COLOR} />
            {tabs}
            <ButtonView
                x={MARGIN}
                y={MONTH_Y}
                width={MONTH_BUTTON_WIDTH}
                height={TAB_HEIGHT}
                label="‹"
                labelSize={26}
                isEnabled={() => model.canShowEarlierMonth}
                onPressed={model.showEarlierMonth}
            />
            <text text={monthText} x={SCREEN_WIDTH / 2} y={MONTH_Y + TAB_HEIGHT / 2} anchor={0.5} style={MONTH_STYLE} tint={INK_COLOR} />
            <ButtonView
                x={MARGIN + GRID_SIZE - MONTH_BUTTON_WIDTH}
                y={MONTH_Y}
                width={MONTH_BUTTON_WIDTH}
                height={TAB_HEIGHT}
                label="›"
                labelSize={26}
                isEnabled={() => model.canShowLaterMonth}
                onPressed={model.showLaterMonth}
            />
            {weekdays}
            {days}
            <text text={footerText} x={SCREEN_WIDTH / 2} y={FOOTER_Y} anchor={0.5} style={SMALL_STYLE} tint={DIM_TEXT_COLOR} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TITLE_STYLE = { fontFamily: FONT_FAMILY, fontSize: 34, fontWeight: '700', fill: 0xffffff };
const MONTH_STYLE = { ...LABEL_STYLE, fontSize: 21 };

function writeFooter(count: number, levelName: string): string {
    if (count === 0) return `No puzzles solved at ${levelName} yet`;
    return `${count} ${count === 1 ? 'puzzle' : 'puzzles'} solved at ${levelName}`;
}
