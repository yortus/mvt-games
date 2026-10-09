/**
 * Every Pixi entry's whole screen, at its thumbnail moment: started
 * headless at its play size and advanced as its thumbnail is (for its
 * `thumbnailAdvanceMs`, playing its `thumbnailInput`), with the runner's
 * code the thumbnail page uses. These catch what no leaf test sees
 * (layout, layering, a view left out of its parent), and so fail on almost
 * any change to an entry: an entry's own commits will often accept a new
 * picture here, beside the leaf tests that say what changed.
 */

import { Container } from 'pixi.js';
import { onTestFinished } from 'vitest';
import { createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { type PixiPictureOptions, visualTest } from '#testing';
import type { ArcadeEntry, PixiEntryStarter } from '../entry-types';
import { advanceHeadless, findThumbnailAdvanceMs, startPixiHeadless } from '../runner';
import { CATALOGUE } from './catalogue';

/**
 * Pixel art over the size budget, cropped to a part that shows the game and
 * its HUD (pixel art is never drawn smaller), in the entry's own pixels.
 */
const CROPS: Readonly<Record<string, Crop>> = {
    // An 8 by 8 board of 200 by 250 tiles over a score bar, 1600 by 2180: three tiles of the bottom two rows, and the score
    'kwazy-cactii': { x: 0, y: 1500, width: 600, height: 680 },
};

// Each entry's code, loaded before its test is declared: whether it is drawn with Pixi, and as pixel art, is known only then
const loaded = await Promise.all(CATALOGUE.map(async (entry) => ({ entry, starter: await entry.load() })));

for (const { entry, starter } of loaded) {
    if (starter.kind !== 'pixi') continue;
    const crop = CROPS[entry.id];
    const options: PixiPictureOptions = {
        artStyle: starter.pixelArt === true ? 'pixel' : 'smooth',
        width: crop?.width ?? entry.screenWidth,
        height: crop?.height ?? entry.screenHeight,
        // As the host draws round a play area
        background: 0x000000,
    };
    visualTest(entry.id, () => pose(entry, starter, crop), options);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Crop {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

function pose(entry: ArcadeEntry, starter: PixiEntryStarter, crop: Crop | undefined): Container {
    const stage = new Container();
    // A headless chip, which makes no sound
    const { audio80, controls } = createHeadlessAudio80();
    const session = startPixiHeadless({ entry, starter, stage, sound: audio80 });
    // After the picture, which destroys the stage; destroying a Pixi object twice is harmless
    onTestFinished(() => session.destroy());
    advanceHeadless({ session, views: [stage], controls, totalMs: findThumbnailAdvanceMs(starter), input: starter.thumbnailInput });
    if (crop === undefined) return stage;
    const cropped = new Container();
    stage.position.set(-crop.x, -crop.y);
    cropped.addChild(stage);
    return cropped;
}
