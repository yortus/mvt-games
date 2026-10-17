import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The harbour fireworks, as the arcade lists them. Their code loads on launch, from `load.ts`, and their long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'fireworks',
    name: 'Harbour Fireworks',
    summary: 'Rockets climb over a city at night and burst into rings of colour, mirrored in the harbour below.',
    tags: { kind: 'art', genres: ['tiny'] },
    screenWidth: 360,
    screenHeight: 300,
    thumbnail,
    cardColor: 'lavender',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
