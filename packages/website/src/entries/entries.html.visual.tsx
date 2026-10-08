/**
 * Every element entry's whole screen, at its thumbnail moment, as
 * `entries.visual.tsx` does for Pixi entries: started in an element of its
 * play size, once its renderers are ready advanced as its thumbnail is,
 * then drawn. An HTML picture, since these entries are part DOM: their text
 * is blank, and their canvases (Pixi, three.js) are drawn as on screen.
 */

import { onTestFinished } from 'vitest';
import { visualTest } from '#testing';
import type { ElementEntryStarter } from '../entry-types';
import { advanceHeadless, thumbnailMomentOf } from '../runner';
import { CATALOGUE } from './catalogue';

/**
 * Entries whose play area is over the size budget, laid out in a smaller
 * one: an HTML picture is never drawn smaller, and an element entry lays
 * itself out to the element it is given, as in a smaller window.
 */
const SIZES: Readonly<Record<string, Size>> = {
    // 1280 by 800, and 960 by 600: both at 880 by 550, the same 16 by 10
    'fruit-machine': { width: 880, height: 550 },
    'boids-3d': { width: 880, height: 550 },
};

// Each entry's code, loaded before its test is declared: whether it is an element entry is known only then
const loaded = await Promise.all(CATALOGUE.map(async (entry) => ({ entry, starter: await entry.load() })));

for (const { entry, starter } of loaded) {
    if (starter.kind !== 'element') continue;
    const size = SIZES[entry.id] ?? { width: entry.screenWidth, height: entry.screenHeight };
    visualTest(entry.id, () => pose(starter, size));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Size {
    readonly width: number;
    readonly height: number;
}

async function pose(starter: ElementEntryStarter, size: Size): Promise<Element> {
    const element = document.createElement('div');
    element.style.cssText = `width:${size.width}px;height:${size.height}px;background:#000;`;
    // In the page while it starts, so it can measure itself
    document.body.append(element);
    const session = starter.start({ element });
    // After the picture, which destroys the element; destroying a view twice is harmless
    onTestFinished(() => session.destroy());
    await session.ready;
    advanceHeadless({ session, views: session.views, totalMs: thumbnailMomentOf(starter) });
    session.render();
    return element;
}
