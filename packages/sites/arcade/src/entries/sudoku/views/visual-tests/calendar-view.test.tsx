import { canvasTest } from 'v-snap';
import type { SudokuModel } from '../../models';
import { CalendarView } from '../calendar-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';
import { poseGame, solve, TODAY } from './sudoku-poses.test-support';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('on a first visit', SIZE, () => pose(() => undefined));

canvasTest('with days solved, and one started', SIZE, () => pose((model) => {
    for (const day of [TODAY - 20, TODAY - 9, TODAY - 8, TODAY - 1]) {
        model.openPuzzle(day);
        solve(model);
        model.closePuzzle();
    }
    model.openPuzzle(TODAY - 4);
    const cell = model.puzzle?.digitAt(0) === 0 ? 0 : 1;
    model.puzzle?.select([cell]);
    model.puzzle?.toggleNote(5);
    model.closePuzzle();
}));

canvasTest('at another level, where none are solved', SIZE, () => pose((model) => {
    model.openPuzzle(TODAY - 1);
    solve(model);
    model.closePuzzle();
    model.chooseLevel('hard');
}));

canvasTest('at the first month, which goes back no further', SIZE, () => pose((model) => {
    for (let i = 0; i < 12; i++) model.showEarlierMonth();
}));

canvasTest('a month back', SIZE, () => pose((model) => model.showEarlierMonth()));

function pose(play: (model: SudokuModel) => void) {
    return poseGame((model) => CalendarView({ model }), play);
}
