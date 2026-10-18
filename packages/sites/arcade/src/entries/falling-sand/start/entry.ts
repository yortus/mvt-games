import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The falling-sand demo, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'falling-sand',
    name: 'Falling Sand',
    summary: 'Pour sand and water into a tank, then flip it: a sprite for every grain, to push the game loop.',
    tags: { kind: 'demo', genres: ['simulation'] },
    screenWidth: 480,
    screenHeight: 722,
    thumbnail,
    // The colour of its sand
    cardColor: 'apricot',
    // The tank, without its controls
    thumbnailCrop: { x: 0, y: 0, width: 480, height: 560 },
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
