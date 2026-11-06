import { createHeadlessAudio90 } from 'audio90/headless';
import { canvasTest } from 'v-snap';
import type { GameModel } from '../../models';
import { GameView } from '../game-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';
import { type Play, playSome, poseGame, TODAY } from './minotaur-poses.test-support';

// The screens themselves are tested in their own views' tests. These show the whole screen switching between them.

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('the calendar', SIZE, () => pose(() => undefined));
canvasTest('a maze', SIZE, () => pose(playSome));
// The puzzle's screen is kept, hidden, while the calendar shows, and must not read the puzzle that closed
canvasTest('back on the calendar from a maze', SIZE, () => pose([playSome, (model) => model.closePuzzle()]));
// A maze of another size, opened after the first: the board is built afresh for it
canvasTest('a hard maze, opened after a medium one', SIZE, () => pose([
    playSome,
    (model) => model.closePuzzle(),
    (model) => {
        model.calendar.chooseLevel('hard');
        model.openPuzzle(TODAY - 1);
    },
]));

// The way in: the card, as the game first opens, then the walkthrough from it. The arrow comes in for 600 ms, and a
// drag presses for 300 before it moves
canvasTest('how to play, on its card over the calendar', SIZE, () => pose((model) => model.intro.showCard()));
canvasTest('the walkthrough, from the calendar, its arrow partway through drawing the path from S', SIZE, () => pose(startWalkthrough, 1300));

/** Opens the card, and starts the walkthrough from it. */
function startWalkthrough(model: GameModel): void {
    model.intro.showCard();
    model.intro.startWalkthrough();
}

function pose(play: Play | readonly Play[], ms?: number) {
    // A headless chip makes no sound, and an image does not depend on what plays
    return poseGame((model) => GameView({ model, sfx: createHeadlessAudio90() }), play, ms);
}
