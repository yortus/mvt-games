import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The fruit machine, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'fruit-machine',
    name: 'Fruit Machine',
    summary: 'One model, four views: a Pixi machine, a three.js one-armed bandit, an HTML control panel and a terminal.',
    tags: { kind: 'demo', genres: [] },
    // It fills whatever it is given; this is the shape of a typical one.
    screenWidth: 1280,
    screenHeight: 800,
    thumbnail,
    // The colour of its pink sign
    cardColor: 'bubblegum',
    // A square of the Pixi machine's reels, in the top left quadrant
    thumbnailCrop: { x: 120, y: 0, width: 400, height: 400 },
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
