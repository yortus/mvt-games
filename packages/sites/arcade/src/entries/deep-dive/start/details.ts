import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Deep Dive's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A one-button game under the sea. The cave winds, narrows and speeds up the further you go, so a run is short. '
        + 'The score is how far you get.',
        'It is one of the smallest games here: one model and one view. The model keeps the submarine and the cave in '
        + 'cave units, and the cave is a formula rather than a list of walls. The view traces the part of it in sight '
        + 'each frame, turning cave units into pixels. The bubbles are the view\'s own presentation state.',
    ].join('\n\n'),
    howToPlay: {
        intro: 'Go as far as you can without touching the rock.',
        controls: [
            { action: 'Rise', inputs: ['space', 'up', { button: 'Rise' }], note: 'Hold to rise, let go to sink' },
            { action: 'Restart', inputs: ['enter'], note: 'After a crash' },
        ],
    },
};
