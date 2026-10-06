import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The boids demo, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'boids',
    name: 'Boids',
    summary: 'A flock of birds from three simple rules, with every parameter on a slider.',
    description: [
        'A bird flocking simulation using the boids algorithm developed by Craig Reynolds in 1986. The three '
        + 'classic rules - separation, alignment, and cohesion - produce emergent flocking behaviour from simple '
        + 'local interactions.',
        'All parameters are tuneable via sliders, and a frame timing panel shows what the flock costs.',
    ].join('\n\n'),
    techniques: [
        'Boids flocking algorithm',
        'Separation / Alignment / Cohesion',
        'Interactive parameter tuning',
        'Domain coordinates in metres',
        'Frame timing panel (perfmon)',
    ],
    tags: { kind: 'demo', genres: ['simulation'] },
    // It lays itself out for the area it plays in; this is the one it is designed around
    screenWidth: 960,
    screenHeight: 605,
    thumbnail,
    // The colour of its flock
    cardColor: 'seafoam',
    // The arena, without its sliders
    thumbnailCrop: { x: 0, y: 0, width: 600, height: 492 },
    load: async () => (await import('./load')).load(),
};
