import { Container, Graphics } from 'pixi.js';
import { advanceTime } from '@mvtjs/pixi';
import { createMemoryStore } from '@mvtjs/site-kit/storage';
import { canvasTest } from 'v-snap';
import { createDailyCalendar, createDailyRecords, type DailyCalendar, type DailyRecords, toDayNumber } from '../../models';
import { CalendarView } from '../calendar-view';
import { PAPER_COLOR } from '../view-constants';

// A game with five levels, which starts on the second, on Friday 30 October 2026.

const SIZE = { width: 540, height: 768, pixelArt: false };
const TODAY = toDayNumber({ year: 2026, month: 10, day: 30 });
const LEVELS = ['easiest', 'easy', 'medium', 'hard', 'hardest'] as const;
type TestLevel = (typeof LEVELS)[number];
const LEVEL_NAMES: Readonly<Record<TestLevel, string>> = { easiest: 'Easiest', easy: 'Easy', medium: 'Medium', hard: 'Hard', hardest: 'Hardest' };

canvasTest('on a first visit', SIZE, () => pose(() => undefined));

canvasTest('with days solved, and one started', SIZE, () => pose((calendar, records) => {
    for (const day of [TODAY - 20, TODAY - 9, TODAY - 8, TODAY - 1]) records.markSolved(day, calendar.level);
    records.writePuzzle(TODAY - 4, calendar.level, {});
}));

canvasTest('at another level, where none are solved', SIZE, () => pose((calendar, records) => {
    records.markSolved(TODAY - 1, calendar.level);
    calendar.chooseLevel('hard');
}));

canvasTest('at the first month, which goes back no further', SIZE, () => pose((calendar) => {
    for (let i = 0; i < 12; i++) calendar.showEarlierMonth();
}));

canvasTest('a month back', SIZE, () => pose((calendar) => calendar.showEarlierMonth()));

/** The calendar on paper, after `play`. */
async function pose(play: (calendar: DailyCalendar<TestLevel>, records: DailyRecords<TestLevel>) => void): Promise<Container> {
    const records = createDailyRecords({ store: createMemoryStore(), gameId: 'test', levels: LEVELS });
    const calendar = createDailyCalendar({
        today: TODAY, firstDay: toDayNumber({ year: 2026, month: 1, day: 1 }), levels: LEVELS, startingLevel: 'easy', records,
    });
    const view = new Container();
    view.addChild(
        new Graphics().rect(0, 0, SIZE.width, SIZE.height).fill(PAPER_COLOR),
        CalendarView({ calendar, title: 'Sudoku', tagline: 'A new puzzle every day, at five levels', levelNames: LEVEL_NAMES, onDayChosen: () => undefined }),
    );
    play(calendar, records);
    await advanceTime(16, view);
    return view;
}
