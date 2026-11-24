import { createHeadlessAudio90 } from 'audio90/headless';
import { canvasTest } from 'v-snap';
import { PAPER_COLOR } from '../../../../shared';
import type { GameModel } from '../../models';
import { GameView } from '../game-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';
import { type Play, playSome, poseGame } from './rosette-poses.test-support';

// The whole screen, in each of its kinds: the calendar, a puzzle, and the way in. The board's own tests show the
// picture in its many states, at the board's size.
const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false, background: PAPER_COLOR };

canvasTest('the calendar', SIZE, () => pose(() => undefined));
canvasTest('a window, partly mended', SIZE, () => pose(playSome));

// The way in: the card, as the game first opens, then the walkthrough from it. The arrow comes in for 600 ms, and a
// drag presses for 300 before it moves
canvasTest('how to play, on its card over the calendar', SIZE, () => pose((model) => model.intro.showCard()));
canvasTest('the walkthrough, its arrow partway through a drag', SIZE, () => pose(startWalkthrough, 1300));

/** Opens the card, and starts the walkthrough from it. */
function startWalkthrough(model: GameModel): void {
    model.intro.showCard();
    model.intro.startWalkthrough();
}

function pose(play: Play | readonly Play[], ms?: number) {
    // A headless chip makes no sound, and an image does not depend on what plays
    return poseGame((model) => GameView({ model, sfx: createHeadlessAudio90() }), play, ms);
}
