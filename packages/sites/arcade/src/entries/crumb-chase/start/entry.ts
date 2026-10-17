import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Crumb Chase, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'crumb-chase',
    name: 'Crumb Chase',
    summary: 'Eat every crumb in the maze before the cats from the pen catch you.',
    tags: { kind: 'game', era: '1980s', genres: ['maze'] },
    screenWidth: 560,
    screenHeight: 470,
    inspiredBy: { title: 'Pac-Man', maker: 'Namco', year: 1980 },
    thumbnail,
    // The colour of its crumbs
    cardColor: 'lemon',
    hasHighscores: true,
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
