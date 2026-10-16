import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The flock in 3D, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'boids-3d',
    name: 'Boids in 3D',
    summary: 'The boids flock, unchanged, drawn with three.js, with an HTML settings panel following the same model.',
    description: [
        'The boids demo\'s flock model, unchanged, drawn with three.js through the same JSX runtime as the Pixi '
        + 'games. The settings panel is HTML, through that runtime too, following the same model: two views of '
        + 'one model, on two renderers.',
        'Each frame runs the MVT way: the model updates, then `updateView` and `refreshView` call both views\' '
        + 'methods, then three.js renders.',
    ].join('\n\n'),
    instructions: 'Click the ground to add boids, or a boid to take some away.',
    techniques: [
        'One model, two renderers: three.js and the DOM',
        'The three.js JSX runtime',
        'Pointer picking in a three.js scene',
        'A camera orbit as presentation state, paused with the views',
    ],
    tags: { kind: 'demo', genres: ['simulation', '3d'] },
    // It fills whatever it is given; this is the shape of a typical one.
    screenWidth: 960,
    screenHeight: 600,
    thumbnail,
    // The colour of its flock
    cardColor: 'sky',
    load: async () => (await import('./load')).load(),
};
