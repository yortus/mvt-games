import { Assets, type Texture } from 'pixi.js';
import { expect, it } from 'vitest';
import { canvasTest } from 'v-snap';
import { advanceTime } from '@mvtjs/pixi';
import { destroyAndFindLeaks } from '@mvtjs/pixi-3d';
import { createArcadeControls } from '@mvtjs/site-kit/input';
import { toDayNumber } from '../../../shared';
import { LEAN_MS, PUZZLE_ENTRIES, TURN_MS } from '../../data';
import { createGameModel, type GameModel, MAX_THINK_MS } from '../../models';
import { GameView } from '../game-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };
/** The paper's view on a phone held upright: the showcase fits its width to the screen's shape, at its own height. */
const UPRIGHT = { width: Math.round(SCREEN_HEIGHT * (390 / 616)), height: SCREEN_HEIGHT, pixelArt: false };
/** Long enough for the margin game's other player to have marked, however long they think. */
const THINK_MS = MAX_THINK_MS + 100;

// The paper lying closed, front page up: the masthead, the date, the lead story and the index of puzzles
canvasTest('the front page', SIZE, async () => {
    const { model, view } = await createPaper();
    await advanceTime(0, model, view);
    return view;
});

// The front page halfway over, curling from its outer edge, uncovering the first spread
canvasTest('a page halfway over', SIZE, async () => {
    const { model, view } = await createPaper();
    model.turnForward();
    await advanceTime(TURN_MS / 2, model, view);
    return view;
});

// The first spread open, with its puzzle's box printed on one page, and stories round it
canvasTest('a spread with a puzzle', SIZE, async () => {
    const { model, view } = await createPaper();
    model.turnForward();
    await advanceTime(TURN_MS, model, view);
    return view;
});

// Leant in to that puzzle, looking straight down on its box, as just before the puzzle plays over it
canvasTest('leant in to a puzzle', SIZE, async () => {
    const { model, view } = await createPaper();
    model.turnForward();
    await advanceTime(TURN_MS, model, view);
    model.playPuzzle();
    await advanceTime(LEAN_MS, model, view);
    return view;
});

// A phone held upright, too narrow for both pages: the reader looks at the page with the puzzle, which fits whole
canvasTest('the first spread, on a phone held upright', UPRIGHT, async () => {
    const { model, view } = await createPaper(UPRIGHT.width);
    model.turnForward();
    await advanceTime(TURN_MS, model, view);
    return view;
});

// The next spread too, since its puzzle may be on the other page
canvasTest('the second spread, on a phone held upright', UPRIGHT, async () => {
    const { model, view } = await createPaper(UPRIGHT.width);
    for (let s = 0; s < 2; s++) {
        model.turnForward();
        await advanceTime(TURN_MS, model, view);
    }
    return view;
});

// The back page open, with a game of noughts and crosses pencilled in its margin: two crosses, and the
// other player's two noughts, the first in the middle, blocking the reader's diagonal
canvasTest('a game in the margin of the back page', SIZE, async () => {
    const { model, view } = await createPaper();
    for (let s = 1; s < model.spreadCount; s++) {
        model.turnForward();
        await advanceTime(TURN_MS, model, view);
    }
    model.markMarginCell(0);
    await advanceTime(THINK_MS, model, view);
    model.markMarginCell(8);
    await advanceTime(THINK_MS, model, view);
    return view;
});

// Putting the paper down destroys its view, and the view must free every geometry, material and texture that its 3D views made.
// The puzzles' pictures are loaded once and shared, so the test lists them as shared, and expects them to survive.
it('frees every resource that its 3D views made when it is destroyed', async () => {
    const { model, view } = await createPaper();
    await advanceTime(0, model, view);
    const pictures = await Promise.all(PUZZLE_ENTRIES.map((entry) => Assets.load<Texture>(entry.thumbnail)));

    expect(destroyAndFindLeaks(view, { shared: pictures })).toEqual([]);
});

// The pages are printed, kept and destroyed by hand as the reader turns, and the margin game draws its own canvas, so
// the reader turns to the back page, marks the margin, and starts back, before the view is destroyed
it('frees every page it printed, and the margin game\'s canvas, after a read through to the back page', async () => {
    const { model, view } = await createPaper();
    for (let s = 1; s < model.spreadCount; s++) {
        model.turnForward();
        await advanceTime(TURN_MS, model, view);
    }
    model.markMarginCell(0);
    await advanceTime(THINK_MS, model, view);
    model.turnBack();
    await advanceTime(TURN_MS / 2, model, view);
    const pictures = await Promise.all(PUZZLE_ENTRIES.map((entry) => Assets.load<Texture>(entry.thumbnail)));

    expect(destroyAndFindLeaks(view, { shared: pictures })).toEqual([]);
});

async function createPaper(width = SCREEN_WIDTH): Promise<{ model: GameModel; view: ReturnType<typeof GameView> }> {
    const pictures = await Promise.all(PUZZLE_ENTRIES.map((entry) => Assets.load<Texture>(entry.thumbnail)));
    const model = createGameModel({
        day: toDayNumber({ year: 2026, month: 11, day: 21 }),
        puzzleAspects: PUZZLE_ENTRIES.map((entry) => entry.screenWidth / entry.screenHeight),
    });
    const view = GameView({ model, controls: createArcadeControls(), puzzles: PUZZLE_ENTRIES, pictures, playRectAt: () => undefined, sfx: undefined, viewWidth: () => width });
    return { model, view };
}
