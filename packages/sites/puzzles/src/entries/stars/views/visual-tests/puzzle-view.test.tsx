import { canvasTest } from 'v-snap';
import type { PuzzleLevel } from '../../../../shared';
import { playShowcase } from '../../models';
import { PuzzleView } from '../puzzle-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';
import { type Play, poseGame, solve, TODAY } from './stars-poses.test-support';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('an easy puzzle, at the start', SIZE, () => pose('easy', () => undefined));
canvasTest('an expert puzzle, at the start', SIZE, () => pose('expert', () => undefined));
// The showcase places the stars of the top rows of a hard puzzle, crosses out the cells round them, and rings a group
canvasTest('part solved, with crosses round the stars and a group ringed', SIZE, () => pose('hard', playShowcase));

canvasTest('rings: an L of three cells, one met by a star, one broken by crosses, and two side by side', SIZE, () => pose('hard', (model) => {
    const puzzle = model.puzzle!;
    const { size } = puzzle.puzzle.grid;
    // An L, top left
    puzzle.noteGroup([size + 1, size * 2 + 1, size * 2 + 2]);
    // A pair with a star in one cell, top right
    puzzle.noteGroup([size - 3, size - 2]);
    puzzle.mark(size - 2, 'star');
    // A pair with a cross in each, bottom left
    puzzle.noteGroup([size * (size - 2), size * (size - 2) + 1]);
    puzzle.mark(size * (size - 2), 'cross');
    puzzle.mark(size * (size - 2) + 1, 'cross');
    // A square of four, and a row of three under it, bottom right
    const corner = size * (size - 3) + size - 3;
    puzzle.noteGroup([corner, corner + 1, corner + size, corner + size + 1]);
    puzzle.noteGroup([corner + size * 2 - 1, corner + size * 2, corner + size * 2 + 1]);
}));

canvasTest('stars that break the rules: two touching, and a row of three', SIZE, () => pose('hard', (model) => {
    const puzzle = model.puzzle!;
    const { size } = puzzle.puzzle.grid;
    // Two stars that touch diagonally, in the middle
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
