import { canvasTest } from 'v-snap';
import type { PuzzleLevel } from '../../../../shared';
import { playShowcase } from '../../models';
import { PuzzleView } from '../puzzle-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';
import { type Play, poseGame, solve, TODAY } from './stars-poses.test-support';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('an easy puzzle, at the start', SIZE, () => pose('easy', () => undefined));
// The showcase places the stars of the top rows, and dots the cells round them
canvasTest('part solved, with dots round the stars', SIZE, () => pose('easy', playShowcase));

canvasTest('stars that break the rules: two touching, and a row of three', SIZE, () => pose('medium', (model) => {
    const puzzle = model.puzzle!;
    const { size } = puzzle.puzzle.grid;
    // Two stars that touch at a corner, in the middle
    const middle = 4 * size + 4;
    puzzle.mark(middle, 'star');
    puzzle.mark(middle + size + 1, 'star');
    // Three stars along the bottom row, none touching
    for (let col = 0; col < 6; col += 2) puzzle.mark((size - 1) * size + col, 'star');
}));

canvasTest('solved, glowing', SIZE, () => pose('easy', solve, 700));

/** The puzzle's screen, on today's puzzle at `level`, after `play`. */
function pose(level: PuzzleLevel, play: Play, ms?: number) {
    return poseGame((model) => {
        model.calendar.chooseLevel(level);
        model.openPuzzle(TODAY);
        return PuzzleView({ model });
    }, (model) => {
        // The showcase opens its own puzzle, so it starts from the calendar
        if (play === playShowcase) model.closePuzzle();
        play(model);
    }, ms);
}
