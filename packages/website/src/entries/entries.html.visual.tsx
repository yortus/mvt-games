/**
 * These tests draw every element entry's whole screen at its thumbnail
 * moment, as `entries.visual.tsx` does for Pixi entries. Each entry is
 * started in an element of its play size. Once its renderers are ready, it
 * is advanced as its thumbnail is, and then drawn. Each picture is an HTML
 * picture, since these entries are partly DOM. Their text is blank, and
 * their canvases (Pixi, three.js) are drawn as they are on screen.
 */

import { onTestFinished } from 'vitest';
import { createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { visualTest } from '@mvtjs/visual-testing';
import type { ElementEntryStarter } from '../entry-types';
import { advanceHeadless, findThumbnailAdvanceMs } from '../runner';
import { CATALOGUE } from './catalogue';

/**
 * Smaller play areas for entries whose play area is over the size budget.
 * An HTML picture is never drawn smaller, so these entries are laid out
 * smaller instead. An element entry lays itself out to the element it is
 * given, as it would in a smaller window.
 */
const SIZES: Readonly<Record<string, Size>> = {
    // The play areas are 1280 by 800 and 960 by 600. Both are drawn at 880 by
    // 550, which has the same 16 by 10 shape.
    'fruit-machine': { width: 880, height: 550 },
    'boids-3d': { width: 880, height: 550 },
};

// Each entry's code is loaded before its test is declared. Only then is it
// known whether the entry is an element entry.
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
    // The element is in the page while the entry starts, so the entry can
    // measure it.
    document.body.append(element);
    // A headless chip makes no sound.
    const { audio80, controls } = createHeadlessAudio80();
    const session = starter.start({ element, sound: audio80 });
    // This runs after the picture, which destroys the element. Destroying a
    // view twice is harmless.
    onTestFinished(() => session.destroy());
    await session.ready;
    advanceHeadless({ session, views: session.views, controls, totalMs: findThumbnailAdvanceMs(starter) });
    session.render();
    return element;
}
