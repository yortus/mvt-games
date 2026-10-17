import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The flock in 3D, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'boids-3d',
    name: 'Boids in 3D',
    summary: 'The boids flock, unchanged, drawn with three.js, with an HTML settings panel following the same model.',
    tags: { kind: 'demo', genres: ['simulation', '3d'] },
    // It fills whatever it is given; this is the shape of a typical one.
    screenWidth: 960,
    screenHeight: 600,
    thumbnail,
    // The colour of its flock
    cardColor: 'sky',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
