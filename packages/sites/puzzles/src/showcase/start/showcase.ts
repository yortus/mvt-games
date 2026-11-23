import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Showcase
// ---------------------------------------------------------------------------

/** The Daily Fold, the puzzles site's showcase. Its code loads as it's chosen, from `load.ts`, and its long text as its info panel opens, from `details.ts`. */
export const showcase: ArcadeEntry = {
    id: 'newspaper',
    name: 'The Daily Fold',
    summary: 'A newspaper on a desk, new every day, with a puzzle printed on each spread. Turn its pages and play one.',
    tags: ['puzzle', '3d'],
    // It lays itself out to fill the area under the nav, at this height. This is the shape it's designed around
    screenWidth: 960,
    screenHeight: 600,
    laysItselfOut: true,
    thumbnail,
    // The puzzle on the first spread, in the picture taken of the paper opened, which a square crop of it keeps in view
    thumbnailFocus: { x: 300, y: 260 },
    cardColor: 'lemon',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
