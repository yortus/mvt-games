import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Neon Monsoon, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'neon-monsoon',
    name: 'Neon Monsoon',
    summary: 'Weave a tiny ship through storms of bullets, with a slow focus mode, screen-clearing bombs and a three-phase boss.',
    tags: { kind: 'game', era: '1990s', genres: ['shooter', 'scrolling'] },
    screenWidth: 240,
    screenHeight: 320,
    thumbnail,
    // The colour of its neon
    cardColor: 'orchid',
    hasHighscores: true,
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
