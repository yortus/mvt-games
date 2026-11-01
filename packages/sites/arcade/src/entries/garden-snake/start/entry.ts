import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Garden Snake, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'garden-snake',
    name: 'Garden Snake',
    summary: 'Steer a hungry snake round the garden. Every berry makes it longer, and faster.',
    tags: ['1970s', 'action', 'tiny'],
    screenWidth: 256,
    screenHeight: 280,
    thumbnail,
    // The garden, the snake and its apple, below the score: what a square crop of its picture keeps in view
    thumbnailFocus: { x: 128, y: 152 },
    cardColor: 'mint',
    hasHighscores: true,
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
