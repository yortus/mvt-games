import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** River, as the puzzles site lists it. Its code loads on launch, from `load.ts`, and its long text after the page's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'river',
    // Marked as a beta until it has been playtested
    name: 'River BETA',
    summary: 'A new valley every day: draw a winding river from the spring to the sea, from the numbers.',
    tags: ['puzzle'],
    screenWidth: 540,
    screenHeight: 768,
    thumbnail,
    // The valley
    thumbnailCrop: { x: 18, y: 76, width: 504, height: 504 },
    // The top of the valley: what a square crop of its picture keeps in view
    thumbnailFocus: { x: 270, y: 120 },
    cardColor: 'seafoam',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
