import { createHeadlessAudio90 } from 'audio90/headless';
import { canvasTest } from 'v-snap';
import type { GameModel } from '../../models';
import { GameView } from '../game-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';
import {
    dragTrimmedPiece, lockOneMore, type Play, playSome, poseGame, solve, swapOneHome, swapTrimmedHome, TODAY,
} from './rosette-poses.test-support';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };
/** Long enough for a mended window's celebration to end, at under 4 s. */
const CELEBRATED_MS = 5000;

canvasTest('the calendar', SIZE, () => pose(() => undefined));
canvasTest('a window, partly mended', SIZE, () => pose(playSome));
// Each level, freshly jumbled, to see how its pieces and colours look
for (const level of ['easy', 'medium', 'hard', 'expert'] as const) {
    canvasTest(`${withArticle(level)} window, jumbled`, SIZE, () => pose((model) => {
        model.calendar.chooseLevel(level);
        model.openPuzzle(TODAY);
    }));
    canvasTest(`${withArticle(level)} window, whole`, SIZE, () => pose([
        (model) => {
            model.calendar.chooseLevel(level);
            model.openPuzzle(TODAY - 1);
        },
        solve,
    ], CELEBRATED_MS));
}
// Two pieces swapping, partway across, each turning to fit the other's tile. A flight takes 420 ms
canvasTest('two pieces swapping, partway across', SIZE, () => pose([(model) => model.openPuzzle(TODAY), swapOneHome], 180));
// A piece put in its place next to a lock, lifting and shaking as the frame grows round it, once the 420 ms flight has landed
canvasTest('a piece joining the locked pieces, lifting as the frame grows round it', SIZE, () => pose([(model) => model.openPuzzle(TODAY), lockOneMore], 560));
// As a window is mended: its ripple partway out from the piece swapped last, once the last two pieces have landed (a
// flight takes 420 ms), then the sun coming up behind it, as it steps back, its light starting to fall on the floor
canvasTest('a window just mended, its ripple spreading', SIZE, () => pose([playSome, solve], 750));
canvasTest('a window mended, the sun coming up behind it', SIZE, () => pose([playSome, solve], 2900));
// A piece the frame trims, picked up and dragged in, showing whole, once it has grown (in 120 ms)
canvasTest('a piece trimmed by the frame, lifted out whole', SIZE, () => pose([(model) => model.openPuzzle(TODAY), dragTrimmedPiece], 200));
// A piece flying out of a tile the frame trims, sliding out from behind the frame, partway through its 420 ms flight
canvasTest('a piece flying out from behind the frame', SIZE, () => pose([(model) => model.openPuzzle(TODAY), swapTrimmedHome], 120));
// A window mended before, opened again: shown whole, with no celebration and no sun behind it
canvasTest('a window mended before, opened again', SIZE, () => pose([
    (model) => model.openPuzzle(TODAY - 1),
    solve,
    (model) => model.closePuzzle(),
    (model) => model.openPuzzle(TODAY - 1),
], CELEBRATED_MS));

// The way in: the card, as the game first opens, then the walkthrough from it. The arrow comes in for 600 ms, and a
// drag presses for 300 before it moves
canvasTest('how to play, on its card over the calendar', SIZE, () => pose((model) => model.intro.showCard()));
canvasTest('the walkthrough, its arrow partway through a drag', SIZE, () => pose(startWalkthrough, 1300));

/** Opens the card, and starts the walkthrough from it. */
function startWalkthrough(model: GameModel): void {
    model.intro.showCard();
    model.intro.startWalkthrough();
}

/** The level's name, with "a" or "an" before it. */
function withArticle(level: string): string {
    return `${/^[aeiou]/.test(level) ? 'an' : 'a'} ${level}`;
}

function pose(play: Play | readonly Play[], ms?: number) {
    // A headless chip makes no sound, and an image does not depend on what plays
    return poseGame((model) => GameView({ model, sfx: createHeadlessAudio90() }), play, ms);
}
