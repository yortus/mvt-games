import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Deep Dive, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'deep-dive',
    name: 'Deep Dive',
    summary: 'Hold to rise, let go to sink, and steer a little submarine through a sea cave that gets tighter and faster.',
    description: [
        'A one-button game under the sea. The cave winds, narrows and speeds up the further you go, so a run is short. '
        + 'The score is how far you get.',
        'It is one of the smallest games here: one model and one view. The model keeps the submarine and the cave in '
        + 'cave units, and the cave is a formula rather than a list of walls. The view traces the part of it in sight '
        + 'each frame, turning cave units into pixels. The bubbles are the view\'s own presentation state.',
    ].join('\n\n'),
    instructions: [
        'Go as far as you can without',
        'touching the rock.',
        '',
        'Space or Up (Rise): hold to rise,',
        'let go to sink',
        'Enter restarts after a crash.',
    ].join('\n'),
    tags: { kind: 'game', era: '2000s', genres: ['action', 'scrolling', 'tiny'] },
    screenWidth: 320,
    screenHeight: 240,
    thumbnail,
    cardColor: 'seafoam',
    load: async () => (await import('./load')).load(),
};
