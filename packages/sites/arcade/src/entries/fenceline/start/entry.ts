import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Fenceline, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'fenceline',
    name: 'Fenceline',
    summary: 'String wire across a wild meadow to fence it off, penning sheep and starving the dust devils.',
    tags: { kind: 'game', era: '1980s', genres: ['action', 'puzzle'] },
    screenWidth: 496,
    screenHeight: 368,
    inspiredBy: { title: 'Qix', maker: 'Taito', year: 1981 },
    thumbnail,
    // The colour of its pasture
    cardColor: 'mint',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
