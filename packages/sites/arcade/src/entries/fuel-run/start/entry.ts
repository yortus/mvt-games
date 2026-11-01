import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Fuel Run, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'fuel-run',
    name: 'Fuel Run',
    summary: 'Fly low over scrolling terrain, bombing fuel tanks to keep flying, while rockets and saucers rise to meet you.',
    tags: ['1980s', 'shooter', 'scrolling'],
    screenWidth: 448,
    screenHeight: 248,
    inspiredBy: { title: 'Scramble', maker: 'Konami', year: 1981 },
    thumbnail,
    // The ship, the saucers and the fuel tanks: what a square crop of its picture keeps in view
    thumbnailFocus: { x: 140, y: 124 },
    // The colour of its hills
    cardColor: 'mint',
    hasHighscores: true,
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
