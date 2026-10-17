import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Fuel Run, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'fuel-run',
    name: 'Fuel Run',
    summary: 'Fly low over scrolling terrain, bombing fuel tanks to keep flying, while rockets and saucers rise to meet you.',
    tags: { kind: 'game', era: '1980s', genres: ['shooter', 'scrolling'] },
    screenWidth: 448,
    screenHeight: 248,
    inspiredBy: { title: 'Scramble', maker: 'Konami', year: 1981 },
    thumbnail,
    // The colour of its hills
    cardColor: 'mint',
    hasHighscores: true,
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
