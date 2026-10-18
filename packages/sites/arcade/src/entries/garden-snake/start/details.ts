import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Garden Snake's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A snake game. Each berry adds a segment and quickens the pace, and running into the fence or your own tail ends it.',
        'It is one of the smallest games here: one model and one view. The model keeps the snake in whole cells, and '
        + 'gives each segment a fractional row and column as it slides between them. The view only turns rows and columns '
        + 'into pixels, so the snake glides rather than jumps.',
    ].join('\n\n'),
    howToPlay: {
        intro: 'Eat the berries; each makes you longer and faster. Hitting the fence or yourself ends the game.',
        controls: [
            { action: 'Steer', inputs: ['arrows', 'wasd', 'swipe'] },
            { action: 'Restart', inputs: ['enter'], note: 'After a game over' },
        ],
    },
};
