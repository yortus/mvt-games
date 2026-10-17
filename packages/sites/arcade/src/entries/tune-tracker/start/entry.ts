import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The Tune Tracker, as the arcade lists it. Its code loads on launch, from `load.ts`, and its long text after the Arcade's first paint, from `details.ts`. */
export const entry: ArcadeEntry = {
    id: 'tune-tracker',
    name: 'Tune Tracker',
    summary: 'Fifteen original tunes in the styles of the 1990s, shown the way a tracker of the time showed music, with the notes scrolling past the row you\'re hearing.',
    tags: { kind: 'demo', era: '1990s', genres: ['sound'] },
    screenWidth: 800,
    screenHeight: 500,
    // The meters, and the pattern's left side round the row playing: the chords, the bass and the bar
    thumbnailCrop: { x: 0, y: 154, width: 400, height: 300 },
    thumbnail,
    cardColor: 'sky',
    loadDetails: async () => (await import('./details')).details,
    load: async () => (await import('./load')).load(),
};
