import { canvasTest } from 'v-snap';
import type { PuzzleLevel } from '../../../../shared';
import { PuzzleView } from '../puzzle-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';
import { type Play, playSome, poseGame, solve, TODAY } from './minotaur-poses.test-support';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('an easy maze, at the start', SIZE, () => pose('easy', () => undefined));
canvasTest('an expert maze, at the start', SIZE, () => pose('expert', () => undefined));
// The showcase draws the path most of the way, and marks walls down the last line
canvasTest('part built, with walls marked', SIZE, () => pose('medium', playSome));

canvasTest('marks that break the rules: a cell with three passages, and a loop', SIZE, () => pose('easy', (model) => {
    const puzzle = model.puzzle!;
    const { grid } = puzzle.maze;
    const middle = 2 * grid.cols + 2;
    for (let side = 0; side < 3; side++) puzzle.mark(grid.cellEdges[middle * 4 + side], 'passage');
    const ring = [grid.cols * 3, grid.cols * 3 + 1, grid.cols * 4 + 1, grid.cols * 4];
    for (let i = 0; i < 4; i++) puzzle.mark(grid.edgeBetween(ring[i], ring[(i + 1) % 4]), 'passage');
}));

canvasTest('solved, glowing, with every wall drawn', SIZE, () => pose('easy', solve, 700));

/** The puzzle's screen, on today's puzzle at `level`, after `play`. */
function pose(level: PuzzleLevel, play: Play | readonly Play[], ms?: number) {
    return poseGame((model) => {
        model.calendar.chooseLevel(level);
        model.openPuzzle(TODAY);
        return PuzzleView({ model });
    }, play, ms);
}
