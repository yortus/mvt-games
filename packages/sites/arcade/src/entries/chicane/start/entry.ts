import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Chicane, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'chicane',
    name: 'Chicane',
    summary: 'Three laps in 3D through a pack of rivals, with missiles. Blast your way through, and dodge the wrecks they leave.',
    tags: ['1990s', '3d', 'action'],
    screenWidth: 640,
    screenHeight: 400,
    thumbnail,
    // The car and the road ahead of it, which a square crop of its picture keeps in view
    thumbnailFocus: { x: 320, y: 220 },
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
