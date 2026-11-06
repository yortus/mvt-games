import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Penrose Tiling, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'penrose-tiling',
    name: 'Penrose Tiling',
    summary: 'Patterns of tiles, most of which never repeat, in shifting colours, with every setting on a slider.',
    tags: ['art', 'ui'],
    // It fills whatever it is given; this is the shape of a typical one.
    screenWidth: 1280,
    screenHeight: 800,
    thumbnail,
    // The colour of its sunset palette
    cardColor: 'orchid',
    // The tiling, left of the panel
    thumbnailCrop: { x: 0, y: 0, width: 960, height: 800 },
    // The middle of the tiling: what a square crop of its picture keeps in view
    thumbnailFocus: { x: 480, y: 400 },
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
