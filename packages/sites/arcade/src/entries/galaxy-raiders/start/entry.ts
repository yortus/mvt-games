import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Galaxy Raiders, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'galaxy-raiders',
    name: 'Galaxy Raiders',
    summary: 'Hold off waves of raiders that break formation to dive at your ship.',
    tags: ['1980s', 'shooter'],
    screenWidth: 280,
    screenHeight: 390,
    inspiredBy: { title: 'Galaga', maker: 'Namco', year: 1981 },
    thumbnail,
    // The colour of its raiders
    cardColor: 'lavender',
    hasHighscores: true,
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
