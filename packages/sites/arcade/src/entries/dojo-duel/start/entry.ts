import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Dojo Duel, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'dojo-duel',
    name: 'Dojo Duel',
    summary: 'A one-on-one karate match against the computer: punches, kicks, sweeps and blocks, best of three rounds.',
    tags: { kind: 'game', era: '1980s', genres: ['fighting'] },
    screenWidth: 384,
    screenHeight: 270,
    inspiredBy: { title: 'International Karate', maker: 'System 3', year: 1985 },
    thumbnail,
    // The colour of its wooden floor
    cardColor: 'apricot',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
