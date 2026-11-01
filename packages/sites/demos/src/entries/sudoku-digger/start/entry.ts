import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Sudoku Digger, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'sudoku-digger',
    name: 'Sudoku Digger',
    summary: 'Watch Sudoku puzzles being made: a full grid grows from random digits, then cells are dug out while the puzzle keeps one solution.',
    tags: ['puzzle'],
    screenWidth: 640,
    screenHeight: 480,
    thumbnail,
    // The grid, not the steps beside it: what a square crop of its picture keeps in view
    thumbnailFocus: { x: 230, y: 240 },
    cardColor: 'lavender',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
