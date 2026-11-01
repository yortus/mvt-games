import { Container, Graphics } from 'pixi.js';
import { canvasTest } from 'v-snap';
import { toDayNumber } from '../../models';
import { DayView, type DayViewBindings } from '../day-view';
import { DAY_SIZE, PAPER_COLOR } from '../view-constants';

// Each pose is 30 October 2026.

const SIZE = { width: DAY_SIZE + 12, height: DAY_SIZE + 12, pixelArt: false };
const DAY = toDayNumber({ year: 2026, month: 10, day: 30 });

canvasTest('to play', SIZE, () => pose({}));
canvasTest('today', SIZE, () => pose({ isToday: () => true }));
canvasTest('started', SIZE, () => pose({ isStarted: () => true }));
canvasTest('solved', SIZE, () => pose({ isStarted: () => true, isSolved: () => true }));
canvasTest('today, solved', SIZE, () => pose({ isToday: () => true, isStarted: () => true, isSolved: () => true }));
canvasTest('not yet playable', SIZE, () => pose({ isPlayable: () => false }));
canvasTest('outside the month, which shows nothing', { ...SIZE, canBeBlank: true }, () => pose({ day: () => -1 }));

/** A day on paper, with `overrides` for its bindings. */
function pose(overrides: Partial<DayViewBindings>): Container {
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, SIZE.width, SIZE.height).fill(PAPER_COLOR));
    view.addChild(DayView({
        x: 6, y: 6, day: () => DAY, isToday: () => false, isPlayable: () => true, isSolved: () => false, isStarted: () => false,
        onPressed: () => undefined,
        ...overrides,
    }));
    return view;
}
