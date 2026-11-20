import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Boats, as the puzzles site lists it. Its code loads on launch, from `load.ts`, and its long text after the page's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'boats',
    // Marked as a beta until it has been playtested
    name: 'Boats BETA',
    summary: 'A new harbour every day: moor the fleet from the numbers, and keep the boats from touching.',
    tags: ['puzzle'],
    screenWidth: 540,
    screenHeight: 768,
    thumbnail,
    // The harbour
    thumbnailCrop: { x: 18, y: 76, width: 504, height: 504 },
    // The top of the harbour: what a square crop of its picture keeps in view
    thumbnailFocus: { x: 270, y: 120 },
    cardColor: 'sky',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
