import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Deep Dive, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'deep-dive',
    name: 'Deep Dive',
    summary: 'Hold to rise, let go to sink, and steer a little submarine through a sea cave that gets tighter and faster.',
    tags: ['2000s', 'action', 'scrolling', 'tiny'],
    screenWidth: 320,
    screenHeight: 240,
    thumbnail,
    cardColor: 'seafoam',
    hasHighscores: true,
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
