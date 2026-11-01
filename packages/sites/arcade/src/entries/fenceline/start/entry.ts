import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Fenceline, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'fenceline',
    name: 'Fenceline',
    summary: 'String wire across a wild meadow to fence it off, penning sheep and starving the dust devils.',
    tags: ['1980s', 'action', 'puzzle'],
    screenWidth: 496,
    screenHeight: 368,
    inspiredBy: { title: 'Qix', maker: 'Taito', year: 1981 },
    thumbnail,
    // The rider, the fence and the field fenced off: what a square crop of its picture keeps in view
    thumbnailFocus: { x: 184, y: 184 },
    // The colour of its pasture
    cardColor: 'mint',
    hasHighscores: true,
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
