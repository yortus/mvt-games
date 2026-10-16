import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The fruit machine, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'fruit-machine',
    name: 'Fruit Machine',
    summary: 'One model, four views: a Pixi machine, a three.js one-armed bandit, an HTML control panel and a terminal.',
    description: [
        'A five-reel fruit machine, played and watched through four views at once: a modern machine in Pixi, an '
        + 'old one-armed bandit in three.js, an HTML control panel, and a text terminal.',
        'Spin from any of them and all four follow, each in its own way. None of them knows the others exist: '
        + 'each reads the one model every frame, and any of them may call its actions.',
    ].join('\n\n'),
    instructions: 'Spin from any quadrant: the Pixi button, the 3D lever, the panel\'s Spin, or `spin` in the '
        + 'terminal. Drag the 3D cabinet to turn it.',
    techniques: [
        'One model, four projections, on three renderers',
        'One loop drives every renderer: update, then updateView and refreshView, then draw',
        'Reels as a domain model; the fruit is the views\' theme',
        'An HTML control panel and a terminal, written in HTML JSX',
    ],
    tags: { kind: 'demo', genres: [] },
    // It fills whatever it is given; this is the shape of a typical one.
    screenWidth: 1280,
    screenHeight: 800,
    thumbnail,
    // The colour of its pink sign
    cardColor: 'bubblegum',
    // A square of the Pixi machine's reels, in the top left quadrant
    thumbnailCrop: { x: 120, y: 0, width: 400, height: 400 },
    load: async () => (await import('./load')).load(),
};
