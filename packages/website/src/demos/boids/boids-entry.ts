import type { ArcadeEntry } from '../../entries';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The boids demo, as the arcade lists it. Its code loads on launch, from `boids-starter.ts`. */
export const boidsEntry: ArcadeEntry = {
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
    // Its play area follows the viewport; this is the shape of a typical one.
    screenWidth: 960,
    screenHeight: 600,
    thumbnail,
    // The colour of its flock
    cardColor: 'seafoam',
    // The arena, without its sliders
    thumbnailCrop: { x: 0, y: 0, width: 592, height: 467 },
    load: async () => (await import('./boids-starter')).loadBoidsStarter(),
};
