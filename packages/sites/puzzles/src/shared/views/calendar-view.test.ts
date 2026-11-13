import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, EventBoundary, FederatedPointerEvent, Text, updateRenderGroupTransforms } from 'pixi.js';
// Pixi's hit testing, which the event boundary does, needs its events added to every container
import 'pixi.js/events';
import { refreshView } from '@mvtjs/pixi';
import { createMemoryStore } from '@mvtjs/site-kit/storage';
import { createDailyCalendar, createDailyRecords, toDayNumber } from '../models';
import { CalendarView } from './calendar-view';
import { DAY_PITCH, DAY_SIZE, DAYS_Y, MARGIN } from './view-constants';

// The calendar's swipes go through Pixi's own event boundary, so taps reach the days just as they do on a
// page: a swipe that ends on the day it began on must not open it.

const TODAY = toDayNumber({ year: 2026, month: 10, day: 30 });
const LEVELS = ['easy', 'hard'] as const;
/** Far enough to swipe, and well short of a day's width. */
const SWIPE = 60;

describe('CalendarView', () => {
    // Hit testing a day's date would measure its text, which needs a canvas, which the unit tests have none of.
    // The day's card under it is hit instead
    beforeEach(() => {
        vi.spyOn(Text.prototype, 'containsPoint').mockReturnValue(false);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows the month after for a swipe to the left, the month before for a swipe to the right, and neither for one down', () => {
        const { calendar, drag } = setUp();
        calendar.showEarlierMonth();
        drag(200, 400, 200 - SWIPE, 400);
        expect(calendar.shownMonth).toBe(10);
        drag(200, 400, 200 + SWIPE, 400);
        expect(calendar.shownMonth).toBe(9);
        drag(200, 400, 200, 400 + SWIPE);
        expect(calendar.shownMonth).toBe(9);
    });

    it('opens a day that is tapped, but not one slid on and let go on the same day', () => {
        const { calendar, chosen, drag } = setUp();
        const { x, y } = middleOfDay(slotOf(calendar, TODAY - 1));
        drag(x, y, x, y);
        expect(chosen).toEqual([TODAY - 1]);
        // Down, so the month stays, and the same day is under the finger as it lets go
        drag(x, y - SWIPE / 2, x, y + SWIPE / 2);
        expect(chosen).toEqual([TODAY - 1]);
    });
});

function setUp() {
    const records = createDailyRecords({ store: createMemoryStore(), gameId: 'test', levels: LEVELS });
    const calendar = createDailyCalendar({
        today: TODAY, firstDay: toDayNumber({ year: 2026, month: 1, day: 1 }), levels: LEVELS, startingLevel: 'easy', records,
    });
    const chosen: number[] = [];
    const stage = new Container();
    stage.addChild(CalendarView({
        calendar, title: 'Test', tagline: 'A test', levelNames: { easy: 'Easy', hard: 'Hard' }, onDayChosen: (day) => chosen.push(day),
    }));
    // Nothing renders here, and Pixi works out where each object is as it renders, so it is done by hand
    stage.enableRenderGroup();
    const boundary = new EventBoundary(stage);

    /** Presses at (`fromX`, `fromY`), slides to (`toX`, `toY`) in four moves, and lets go there. */
    function drag(fromX: number, fromY: number, toX: number, toY: number): void {
        refreshView(stage);
        updateRenderGroupTransforms(stage.renderGroup, true);
        boundary.mapEvent(pointerEvent(boundary, 'pointerdown', fromX, fromY));
        for (let i = 1; i <= 4; i++) {
            boundary.mapEvent(pointerEvent(boundary, 'pointermove', fromX + (toX - fromX) * i / 4, fromY + (toY - fromY) * i / 4));
        }
        boundary.mapEvent(pointerEvent(boundary, 'pointerup', toX, toY));
    }

    return { calendar, chosen, drag };
}

/** Returns the slot on the calendar's page that shows `day`. */
function slotOf(calendar: { dayInSlot: (slot: number) => number }, day: number): number {
    let slot = 0;
    while (calendar.dayInSlot(slot) !== day) slot++;
    return slot;
}

/** Returns the middle of the day card in `slot`, in the screen's pixels. */
function middleOfDay(slot: number): { x: number; y: number } {
    return {
        x: MARGIN + (slot % 7) * DAY_PITCH + 3 + DAY_SIZE / 2,
        y: DAYS_Y + Math.floor(slot / 7) * DAY_PITCH + 3 + DAY_SIZE / 2,
    };
}

function pointerEvent(boundary: EventBoundary, type: string, x: number, y: number): FederatedPointerEvent {
    const event = new FederatedPointerEvent(boundary);
    event.type = type;
    event.pointerId = 1;
    event.pointerType = 'touch';
    event.isPrimary = true;
    event.button = 0;
    event.global.set(x, y);
    event.screen.set(x, y);
    return event;
}
