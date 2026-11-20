import { canvasTest } from 'v-snap';
import type { PuzzleLevel } from '../../../../shared';
import { playShowcase } from '../../models';
import { PuzzleView } from '../puzzle-view';
import { FLOW_MS, SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';
import { type Play, poseGame, solve, TODAY } from './river-poses.test-support';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('an easy valley, at the start', SIZE, () => pose('easy', () => undefined));
canvasTest('an expert valley, at the start', SIZE, () => pose('expert', () => undefined));
// The showcase opens a hard valley, draws the first half of the river, and plants flowers beside it
canvasTest('part solved, with half the river drawn and flowers beside it', SIZE, () => poseGame((model) => {
    playShowcase(model);
    return PuzzleView({ model });
}, () => undefined, 900));

canvasTest('rivers that break the rules: a loop, three ways from one cell, and a river through a flower', SIZE, () => pose('hard', (model) => {
    const puzzle = model.puzzle!;
    const { grid } = puzzle.puzzle;
    const { size, edgeBetween } = grid;
    // A loop round four cells, top right
    const corner = size + size - 3;
    puzzle.setRiver(edgeBetween(corner, corner + 1), true);
    puzzle.setRiver(edgeBetween(corner + 1, corner + 1 + size), true);
    puzzle.setRiver(edgeBetween(corner + 1 + size, corner + size), true);
    puzzle.setRiver(edgeBetween(corner + size, corner), true);
    // Three ways from one cell, bottom right
    const fork = size * (size - 3) + size - 3;
    puzzle.setRiver(edgeBetween(fork, fork - 1), true);
    puzzle.setRiver(edgeBetween(fork, fork + 1), true);
    puzzle.setRiver(edgeBetween(fork, fork + size), true);
    // A flower with the river through it, in the middle
    const middle = size * 4 + 3;
    puzzle.setMeadow(middle, true);
    puzzle.setRiver(edgeBetween(middle, middle + 1), true);
}));

// The light takes FLOW_MS to run from the spring to the sea, so these poses are timed from it
canvasTest('solved, with the light halfway down the river', SIZE, () => pose('medium', solve, FLOW_MS / 2));
canvasTest('solved, with the light at the sea and the meadow in bloom', SIZE, () => pose('easy', solve, FLOW_MS + 200));

/** The puzzle's screen, on today's valley at `level`, after `play`. */
function pose(level: PuzzleLevel, play: Play, ms?: number) {
    return poseGame((model) => {
        model.calendar.chooseLevel(level);
        model.openPuzzle(TODAY);
        return PuzzleView({ model });
    }, play, ms);
}
