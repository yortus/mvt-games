import { createHeadlessAudio90 } from 'audio90/headless';
import { canvasTest } from 'v-snap';
import { GameView } from '../game-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';
import { poseGame } from './stars-poses.test-support';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('the calendar', SIZE, () => poseGame(makeGameView, () => undefined));
canvasTest('how to play, on its card over the calendar', SIZE, () => poseGame(makeGameView, (model) => model.intro.showCard()));
canvasTest('the walkthrough, at its first step', SIZE, () => poseGame(makeGameView, (model) => {
    model.intro.showCard();
    model.intro.startWalkthrough();
}, 400));

function makeGameView(model: Parameters<typeof GameView>[0]['model']) {
    return GameView({ model, sfx: createHeadlessAudio90() });
}
