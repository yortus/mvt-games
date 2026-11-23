import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Showcase
// ---------------------------------------------------------------------------

/** The Arcade Hall, the arcade's showcase. Its code loads as it's chosen, from `load.ts`, and its long text as its info panel opens, from `details.ts`. */
export const showcase: ArcadeEntry = {
    id: 'arcade-hall',
    name: 'Arcade Hall',
    summary: 'Walk round a 3D arcade, step up to a cabinet, and play the game on its screen.',
    tags: ['1990s', '3d'],
    // It lays itself out to fill the area under the nav, at this height. This is the shape it's designed around
    screenWidth: 960,
    screenHeight: 540,
    laysItselfOut: true,
    thumbnail,
    // The aisle and the cabinets nearest it, which a square crop of its picture keeps in view
    thumbnailFocus: { x: 480, y: 280 },
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
