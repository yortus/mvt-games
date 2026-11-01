import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Astrovoid, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'astrovoid',
    name: 'Astrovoid',
    summary: 'Rotate, thrust and fire to break drifting rocks into ever smaller pieces, in an arena that wraps at its edges.',
    tags: ['1970s', 'shooter'],
    screenWidth: 400,
    screenHeight: 430,
    inspiredBy: { title: 'Asteroids', maker: 'Atari', year: 1979 },
    thumbnail,
    // The rocks and the ship, above the score: what a square crop of its picture keeps in view
    thumbnailFocus: { x: 200, y: 200 },
    hasHighscores: true,
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
