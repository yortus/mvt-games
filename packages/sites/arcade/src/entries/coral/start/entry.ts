import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Coral, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'coral',
    name: 'Coral',
    summary: 'Two chemicals spread and react, growing into coral, spots and stripes that slowly change. Tap to plant a seed.',
    tags: { kind: 'demo', genres: ['simulation', 'art'] },
    screenWidth: 480,
    screenHeight: 360,
    thumbnail,
    cardColor: 'peach',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
