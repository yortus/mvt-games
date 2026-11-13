import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Stars, as the puzzles site lists it. Its code loads on launch, from `load.ts`, and its long text after the page's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'stars',
    // Marked as a beta while its puzzle maker is too slow for bigger grids, and its levels are settled
    name: 'Stars BETA',
    summary: 'A new puzzle of stars every day: two in every row, column and region, and no two touching.',
    tags: ['puzzle'],
    screenWidth: 540,
    screenHeight: 768,
    thumbnail,
    // The grid
    thumbnailCrop: { x: 18, y: 119, width: 504, height: 504 },
    // The top of the grid: what a square crop of its picture keeps in view
    thumbnailFocus: { x: 270, y: 119 },
    cardColor: 'lavender',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
