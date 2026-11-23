import { Assets, type Texture } from 'pixi.js';
import { expect, it } from 'vitest';
import { canvasTest } from 'v-snap';
import { advanceTime } from '@mvtjs/pixi';
import { destroyAndFindLeaks } from '@mvtjs/pixi-3d';
import { createArcadeControls } from '@mvtjs/site-kit/input';
import { CABINET_ENTRIES, FINAL_DEPTH, HALL_LENGTH, STEP_MS, WALK_SPEED, WHITE_IN_MS, WHITE_OUT_MS } from '../../data';
import { createGameModel, type GameModel } from '../../models';
import { showcase as hallEntry } from '../../start';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../game-view';
import { MEADOW_CHUNK_SIZE } from '../meadow-chunk-geometry';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

// Standing at the entrance, looking down the aisle between the two rows of cabinets
canvasTest('at the entrance', SIZE, async () => {
    const { model, view } = await createHall();
    await advanceTime(0, model, view);
    return view;
});

// Turned to face the first cabinet on the left, close enough to play it, with the hint showing
canvasTest('in reach of a cabinet', SIZE, async () => {
    const { model, view } = await createHall();
    model.walking = 'forward';
    await advanceTime(700, model, view);
    model.walking = 'none';
    // A quarter turn to the left, as a drag across the view would turn
    model.turnBy(-Math.PI / 2);
    await walkUpToCabinet(model, view);
    return view;
});

// Leant in to that cabinet, with its screen in the middle of the view, showing its picture, as it would just before its game plays over it
canvasTest('stepped up to a cabinet', SIZE, async () => {
    const { model, view } = await createHall();
    model.walking = 'forward';
    await advanceTime(700, model, view);
    model.walking = 'none';
    // A quarter turn to the left, as a drag across the view would turn
    model.turnBy(-Math.PI / 2);
    await walkUpToCabinet(model, view);
    model.playCabinetInReach();
    await advanceTime(600, model, view);
    return view;
});

// The last hall, empty but for the button box, seen as the visitor walks up to it
canvasTest('in the last hall, at the button', SIZE, async () => {
    const { model, view } = await createHall();
    goToTheLastHall(model);
    model.walking = 'forward';
    await advanceTime(walkMsFor(HALL_LENGTH * 0.6), model, view);
    model.walking = 'none';
    return view;
});

// Just arrived outside, in the clearing, looking down the valley
canvasTest('in the meadow', SIZE, async () => {
    const { model, view } = await createHall();
    goOutside(model);
    await advanceTime(500, model, view);
    return view;
});

// Leaving the hall destroys its view, and the view must free every geometry, material and texture that its 3D views made.
// The games' pictures are loaded once and shared, so the test lists them as shared, and expects them to survive.
it('frees every resource that its 3D views made when it is destroyed', async () => {
    const { model, view } = await createHall();
    await advanceTime(0, model, view);
    const pictures = await Promise.all([...CABINET_ENTRIES, hallEntry].map((entry) => Assets.load<Texture>(entry.thumbnail)));

    expect(destroyAndFindLeaks(view, { shared: pictures })).toEqual([]);
});

// The meadow's ground is built in chunks, made and freed by hand as the visitor walks, so they walk across a chunk's edge first
it('frees the meadow\'s chunks of ground too, after a walk outside', async () => {
    const { model, view } = await createHall();
    goOutside(model);
    model.walking = 'forward';
    await advanceTime(walkMsFor(MEADOW_CHUNK_SIZE * 1.5), model, view);
    const pictures = await Promise.all([...CABINET_ENTRIES, hallEntry].map((entry) => Assets.load<Texture>(entry.thumbnail)));

    expect(destroyAndFindLeaks(view, { shared: pictures })).toEqual([]);
});

async function walkUpToCabinet(model: GameModel, view: ReturnType<typeof GameView>): Promise<void> {
    model.walking = 'forward';
    await advanceTime(800, model, view);
    model.walking = 'none';
    await advanceTime(0, model, view);
}

/** Steps into the hall cabinet, hall after hall, with the model alone, until the visitor reaches the last hall. */
function goToTheLastHall(model: GameModel): void {
    while (model.depth < FINAL_DEPTH) {
        model.walking = 'forward';
        walkFor(model, walkMsFor(HALL_LENGTH));
        model.walking = 'none';
        model.playCabinetInReach();
        walkFor(model, STEP_MS);
    }
}

/** Goes to the last hall, presses the button, and waits, with the model alone, until the visitor has arrived in the meadow. */
function goOutside(model: GameModel): void {
    goToTheLastHall(model);
    model.goOutside();
    walkFor(model, WHITE_OUT_MS + WHITE_IN_MS);
}

function walkFor(model: GameModel, ms: number): void {
    for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) model.update(FRAME_MS);
}

/** How long the visitor takes to walk `metres`. */
function walkMsFor(metres: number): number {
    return (metres / WALK_SPEED) * 1000;
}

const FRAME_MS = 1000 / 60;

async function createHall(): Promise<{ model: GameModel; view: ReturnType<typeof GameView> }> {
    const entries = [...CABINET_ENTRIES, hallEntry];
    const thumbnails = await Promise.all(entries.map((entry) => Assets.load<Texture>(entry.thumbnail)));
    const model = createGameModel({ cabinetCount: CABINET_ENTRIES.length });
    const view = GameView({
        model,
        controls: createArcadeControls(),
        entries,
        thumbnails,
        gameAt: () => undefined,
        playRectAt: () => undefined,
        showsHud: true,
        hasMeadow: true,
        depth: () => model.depth,
        sfx: undefined,
    });
    return { model, view };
}
