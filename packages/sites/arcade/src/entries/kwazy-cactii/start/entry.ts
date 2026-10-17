import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Kwazy Cactii, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'kwazy-cactii',
    name: 'Kwazy Cactii',
    summary: 'Swap neighbouring cactii to line up three or more of a kind, and chain the cascades for bonus points.',
    tags: { kind: 'game', era: '2000s', genres: ['puzzle'] },
    screenWidth: 1600,
    screenHeight: 2180,
    thumbnail,
    // The colour of its cactii
    cardColor: 'mint',
    hasHighscores: true,
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
