import { createHeadlessAudio90 } from 'audio90/headless';
import { canvasTest } from 'v-snap';
import { SudokuView } from '../sudoku-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';
import { type Play, playSome, poseGame } from './sudoku-poses.test-support';

// The screens themselves are tested in their own views' tests. These show the whole screen switching between them.

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('the calendar', SIZE, () => pose(() => undefined));
canvasTest('a puzzle', SIZE, () => pose(playSome));
// The puzzle's screen is kept, hidden, while the calendar shows, and its update steps must not read the puzzle that closed
canvasTest('back on the calendar from a puzzle', SIZE, () => pose([playSome, (model) => model.closePuzzle()]));

function pose(play: Play | readonly Play[]) {
    // A headless chip makes no sound, and an image does not depend on what plays
    return poseGame((model) => SudokuView({ model, sfx: createHeadlessAudio90() }), play);
}
