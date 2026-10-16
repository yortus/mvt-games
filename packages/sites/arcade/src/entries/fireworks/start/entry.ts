import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The harbour fireworks, as the arcade lists them. Their code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'fireworks',
    name: 'Harbour Fireworks',
    summary: 'Rockets climb over a city at night and burst into rings of colour, mirrored in the harbour below.',
    description: [
        'A fireworks show that never ends. Each rocket bursts at the top of its climb, and its sparks spread, '
        + 'slow, fall and fade, behind the city and again, dimmer and upside down, in the water.',
        'The model is the rockets and a fixed pool of sparks, moved in sky units only in its update. The view '
        + 'shows the same pool twice: once in the sky, and once flipped about the water line as the reflection.',
    ].join('\n\n'),
    tags: { kind: 'art', genres: ['tiny'] },
    screenWidth: 360,
    screenHeight: 300,
    thumbnail,
    cardColor: 'lavender',
    load: async () => (await import('./load')).load(),
};
