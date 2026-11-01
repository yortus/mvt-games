import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Minotaur, as the puzzles site lists it. Its code loads on launch, from `load.ts`, and its long text after the page's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'minotaur',
    name: 'Minotaur',
    summary: 'A new maze to build every day, at four levels: one path through every cell, and numbers that say where the walls go.',
    tags: ['puzzle', 'maze'],
    screenWidth: 540,
    screenHeight: 768,
    thumbnail,
    // The maze and its clues
    thumbnailCrop: { x: 8, y: 76, width: 524, height: 590 },
    // The top of the maze: what a square crop of its picture keeps in view
    thumbnailFocus: { x: 270, y: 76 },
    cardColor: 'mint',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
