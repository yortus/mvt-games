import { createHeadlessAudio90 } from 'audio90/headless';
import { canvasTest } from 'v-snap';
import type { GameModel } from '../../models';
import { GameView } from '../game-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';
import { poseGame } from './boats-poses.test-support';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('the calendar', SIZE, () => poseGame(makeGameView, () => undefined));
canvasTest('how to play, on its card over the calendar', SIZE, () => poseGame(makeGameView, (model) => model.intro.showCard()));
// The arrow comes in for 600 ms, so at 400 ms it's still on its way to the first cell
canvasTest('the walkthrough, at its first step', SIZE, () => poseGame(makeGameView, (model) => {
    model.intro.showCard();
    model.intro.startWalkthrough();
}, 400));

function makeGameView(model: GameModel) {
    return GameView({ model, sfx: createHeadlessAudio90() });
}
