import type { ArcadeEntry } from '@mvtjs/site-kit/entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The harbour fireworks, as the arcade lists them. Their code loads on launch, from `load.ts`, and their long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'fireworks',
    name: 'Harbour Fireworks',
    summary: 'Rockets climb over a city at night and burst into rings of colour, mirrored in the harbour below.',
    tags: ['art', 'tiny'],
    screenWidth: 360,
    screenHeight: 300,
    thumbnail,
    // The bursts, over the city: what a square crop of its picture keeps in view
    thumbnailFocus: { x: 200, y: 150 },
    cardColor: 'lavender',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
