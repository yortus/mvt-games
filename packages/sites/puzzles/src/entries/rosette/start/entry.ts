import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Rosette, as the puzzles site lists it. Its code loads on launch, from `load.ts`, and its long text after the page's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'rosette',
    name: 'Rosette',
    summary: 'A new window to mend every day, at four levels: swap its pieces of coloured glass until the gradient runs smoothly again.',
    tags: ['puzzle'],
    screenWidth: 540,
    screenHeight: 768,
    thumbnail,
    // The window, mended and stepped back, with the sun behind it, and its light on the floor below
    thumbnailCrop: { x: 20, y: 64, width: 500, height: 534 },
    // The window: what a square crop of its picture keeps in view, from just above its top
    thumbnailFocus: { x: 270, y: 300 },
    cardColor: 'lavender',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
