/**
 * These tests draw every Pixi entry's whole screen at its thumbnail moment.
 * Each entry is started headless at its play size. It is then advanced as
 * its thumbnail is, for its `thumbnailAdvanceMs` and playing its
 * `thumbnailInput`. The tests use the same runner code as the thumbnail
 * page. They catch what no test of a single view sees, such as layout,
 * layering, or a view left out of its parent. So they fail on almost any
 * change to an entry. An entry's own commits will often accept a new picture
 * here, beside the tests of single views that say what changed.
 */

import { Container } from 'pixi.js';
import { onTestFinished } from 'vitest';
import { createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { type PixiPictureOptions, visualTest } from '#testing';
import type { ArcadeEntry, PixiEntryStarter } from '../entry-types';
import { advanceHeadless, findThumbnailAdvanceMs, startPixiHeadless } from '../runner';
import { CATALOGUE } from './catalogue';

/**
 * Crops for pixel-art entries whose screens are over the size budget. Pixel
 * art is never drawn smaller, so each picture shows only a part of the
 * screen that shows the game and its HUD. The crops are in the entry's own
 * pixels.
 */
const CROPS: Readonly<Record<string, Crop>> = {
    // The screen is 1600 by 2180. It holds an 8 by 8 board of 200 by 250 tiles
    // over a score bar. The crop shows three tiles of the bottom two rows, and
    // the score.
    'kwazy-cactii': { x: 0, y: 1500, width: 600, height: 680 },
};

// Each entry's code is loaded before its test is declared. Only then is it
// known whether the entry is drawn with Pixi, and whether it is pixel art.
const loaded = await Promise.all(CATALOGUE.map(async (entry) => ({ entry, starter: await entry.load() })));

for (const { entry, starter } of loaded) {
    if (starter.kind !== 'pixi') continue;
    const crop = CROPS[entry.id];
    const options: PixiPictureOptions = {
        artStyle: starter.pixelArt === true ? 'pixel' : 'smooth',
        width: crop?.width ?? entry.screenWidth,
        height: crop?.height ?? entry.screenHeight,
        // The host draws black round a play area, and so does the picture.
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
    // A headless chip makes no sound.
    const { audio80, controls } = createHeadlessAudio80();
    const session = startPixiHeadless({ entry, starter, stage, sound: audio80 });
    // This runs after the picture, which destroys the stage. Destroying a Pixi
    // object twice is harmless.
    onTestFinished(() => session.destroy());
    advanceHeadless({ session, views: [stage], controls, totalMs: findThumbnailAdvanceMs(starter), input: starter.thumbnailInput });
    if (crop === undefined) return stage;
    const cropped = new Container();
    stage.position.set(-crop.x, -crop.y);
    cropped.addChild(stage);
    return cropped;
}
