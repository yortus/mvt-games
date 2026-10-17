import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** The double pendulum's long text, for its info panel, the pause menu and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'Two arms, the second shorter and hanging from the end of the first, swing under gravity. The smallest change '
        + 'to where they start sends them on a different path, and a fading trail follows the lower one.',
        'Time reaches the model only through its update, and it advances in fixed one-millisecond steps. So the '
        + 'swing is the same at any frame rate, and pausing, slowing, speeding up and stepping are only changes to how much '
        + 'time it is given. The trail is the view\'s own presentation state, kept in its update step.',
    ].join('\n\n'),
    techniques: [
        'Physics in fixed time steps',
        'Pause, slow and fast motion, and frame stepping',
        'Nested containers for jointed arms',
        'Presentation state: a ring buffer trail',
    ],
};
