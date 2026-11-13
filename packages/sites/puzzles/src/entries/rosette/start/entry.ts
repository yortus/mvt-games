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
    // The window
    thumbnailCrop: { x: 8, y: 72, width: 524, height: 560 },
    thumbnailFocus: { x: 270, y: 352 },
    cardColor: 'lavender',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
