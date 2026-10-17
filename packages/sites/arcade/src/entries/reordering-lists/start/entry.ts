import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The reordering-lists demo, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'reordering-lists',
    name: 'Reordering Lists',
    summary: 'Two rows of cards, sorted, shuffled and trimmed by a script, sliding into place as they go.',
    tags: { kind: 'demo', genres: ['ui'] },
    screenWidth: 600,
    screenHeight: 420,
    thumbnail,
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
