import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Showcase
// ---------------------------------------------------------------------------

/** The Gallery, the demos site's showcase. Its code loads as it's chosen, from `load.ts`, and its long text as its info panel opens, from `details.ts`. */
export const showcase: ArcadeEntry = {
    id: 'gallery',
    name: 'The Gallery',
    summary: 'Stroll round a bright 3D gallery, with every demo hung on its walls. Step up to a painting to run its demo.',
    tags: ['3d'],
    // It lays itself out to fill the area under the nav, at this height. This is the shape it's designed around
    screenWidth: 960,
    screenHeight: 540,
    laysItselfOut: true,
    thumbnail,
    // The corridor and the first paintings along it, which a square crop of its picture keeps in view
    thumbnailFocus: { x: 480, y: 270 },
    cardColor: 'lemon',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
