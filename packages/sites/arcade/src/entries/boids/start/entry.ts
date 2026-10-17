import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The boids demo, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'boids',
    name: 'Boids',
    summary: 'A flock of birds from three simple rules, with every parameter on a slider.',
    tags: { kind: 'demo', genres: ['simulation'] },
    // It lays itself out for the area it plays in; this is the one it is designed around
    screenWidth: 960,
    screenHeight: 605,
    thumbnail,
    // The colour of its flock
    cardColor: 'seafoam',
    // The arena, without its sliders
    thumbnailCrop: { x: 0, y: 0, width: 600, height: 492 },
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
