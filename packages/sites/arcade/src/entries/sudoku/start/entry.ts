import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Sudoku, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'sudoku',
    name: 'Sudoku',
    summary: 'A new Sudoku puzzle every day, at five levels, with notes that can link cells: a pair across two cells shows as one note.',
    tags: { kind: 'game', genres: ['puzzle'] },
    screenWidth: 540,
    screenHeight: 768,
    thumbnail,
    // The grid, with notes in it
    thumbnailCrop: { x: 8, y: 72, width: 524, height: 524 },
    cardColor: 'lemon',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
