import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Burrow Bust, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'burrow-bust',
    name: 'Burrow Bust',
    summary: 'Dig tunnels through the earth, and pump up the creatures that chase you along them.',
    tags: { kind: 'game', era: '1980s', genres: ['maze', 'action'] },
    screenWidth: 280,
    screenHeight: 390,
    inspiredBy: { title: 'Dig Dug', maker: 'Namco', year: 1982 },
    thumbnail,
    // The colour of its earth
    cardColor: 'peach',
    hasHighscores: true,
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
