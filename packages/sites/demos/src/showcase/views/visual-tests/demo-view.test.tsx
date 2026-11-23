import { Assets, type Texture } from 'pixi.js';
import { expect, it } from 'vitest';
import { canvasTest } from 'v-snap';
import { advanceTime } from '@mvtjs/pixi';
import { destroyAndFindLeaks } from '@mvtjs/pixi-3d';
import { createArcadeControls } from '@mvtjs/site-kit/input';
import { GALLERY_ENTRIES, HANGING_SPOTS, START_X, START_Z, VIEW_DISTANCE, WALK_SPEED } from '../../data';
import { createDemoModel, type DemoModel } from '../../models';
import { DemoView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../demo-view';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

// Just inside the door, looking along the first corridor, with paintings on both walls and a bench down the middle
canvasTest('inside the door', SIZE, async () => {
    const { model, view } = await createGallery();
    await advanceTime(0, model, view);
    return view;
});

// Turned to face the first painting, close enough to view it, with the hint showing
canvasTest('in reach of a painting', SIZE, async () => {
    const { view } = await walkUpToFirstPainting();
    return view;
});

// Leant in to the first painting, with it in the middle of the view, as it would be just before its demo runs over it
canvasTest('stepped up to a painting', SIZE, async () => {
    const { model, view } = await walkUpToFirstPainting();
    model.viewPaintingInReach();
    await advanceTime(700, model, view);
    return view;
});

// In the lantern room, the gallery's hidden room, a few steps in from its door, looking up a little, with the
// lanterns near the visitor risen and glowing, and those behind them still settling
canvasTest('in the lantern room', SIZE, async () => {
    const { model, view } = await createGallery();
    // Back out through the door they came in by, and on into the room
    model.turnBy(Math.PI);
    model.walking = 'forward';
    await advanceTime(2200, model, view);
    model.walking = 'none';
    // Looking up a little, as a drag up would, to see the lanterns that have risen
    model.tiltBy(0.25);
    await advanceTime(300, model, view);
    return view;
});

// Leaving the gallery destroys its view, and the view must free every geometry, material and texture that its 3D views made.
// The paintings' pictures are loaded once and shared, so the test lists them as shared, and expects them to survive.
it('frees every resource that its 3D views made when it is destroyed', async () => {
    const { model, view } = await createGallery();
    await advanceTime(0, model, view);
    const pictures = await Promise.all(GALLERY_ENTRIES.map((entry) => Assets.load<Texture>(entry.thumbnail)));

    expect(destroyAndFindLeaks(view, { shared: pictures })).toEqual([]);
});

/** Walks to the first painting, on the north wall, a few steps in from the door, and turns to face it. */
async function walkUpToFirstPainting(): Promise<{ model: DemoModel; view: ReturnType<typeof DemoView> }> {
    const gallery = await createGallery();
    const { model, view } = gallery;
    model.walking = 'forward';
    await advanceTime(walkMsFor(HANGING_SPOTS[0].x - START_X), model, view);
    model.walking = 'none';
    // A quarter turn to the left, to face north, as a drag across the view would turn
    model.turnBy(-Math.PI / 2);
    model.walking = 'forward';
    await advanceTime(walkMsFor(START_Z - (HANGING_SPOTS[0].z + VIEW_DISTANCE)), model, view);
    model.walking = 'none';
    await advanceTime(0, model, view);
    return gallery;
}

async function createGallery(): Promise<{ model: DemoModel; view: ReturnType<typeof DemoView> }> {
    const thumbnails = await Promise.all(GALLERY_ENTRIES.map((entry) => Assets.load<Texture>(entry.thumbnail)));
    const model = createDemoModel({ paintingCount: GALLERY_ENTRIES.length });
    const view = DemoView({
        model,
        controls: createArcadeControls(),
        entries: GALLERY_ENTRIES,
        thumbnails,
        liveAt: () => undefined,
        playRectAt: () => undefined,
    });
    return { model, view };
}

/** How long the visitor takes to walk `metres`. */
function walkMsFor(metres: number): number {
    return (metres / WALK_SPEED) * 1000;
}
