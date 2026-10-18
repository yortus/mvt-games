import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Fractal Forest, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'fractal-forest',
    name: 'Fractal Forest',
    summary: 'A small forest of fractal trees grows, leafs, turns and sheds through a year in a minute, then grows anew.',
    tags: { kind: 'demo', genres: ['art'] },
    screenWidth: 480,
    screenHeight: 360,
    thumbnail,
    cardColor: 'mint',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
