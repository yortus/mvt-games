import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The fruit machine, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'fruit-machine',
    name: 'Fruit Machine',
    summary: 'One model, four views: a Pixi machine, a three.js one-armed bandit, an HTML control panel and a terminal.',
    tags: [],
    // It fills whatever it is given; this is the shape of a typical one.
    screenWidth: 1280,
    screenHeight: 800,
    thumbnail,
    // The colour of its pink sign
    cardColor: 'bubblegum',
    // A square of the Pixi machine's reels, in the top left quadrant
    thumbnailCrop: { x: 120, y: 0, width: 400, height: 400 },
    // It looks like gambling, so it says plainly what it is
    notice: {
        title: 'A game of chance, for show',
        text: 'This is a programming demo, not gambling. No money goes in or comes out, and nothing can be bought or '
            + 'won. The credits are pretend, and when they run out, the game is over.'
            + '\n\n'
            + 'Each spin\'s result is decided the moment it starts. The spinning reels only put on a show. Open Peek in '
            + 'the control panel to see the result before they stop.',
    },
    // The reels: what a square crop of its picture keeps in view
    thumbnailFocus: { x: 320, y: 200 },
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
