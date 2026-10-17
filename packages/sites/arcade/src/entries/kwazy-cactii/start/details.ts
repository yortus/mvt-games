import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Kwazy Cactii's long text, for its info panel, the pause menu and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A match-three puzzle. Drag a cactus onto its neighbour to swap them; a row or column of three or '
        + 'more of a kind clears, and the cactii above fall to fill the gap, sometimes setting off more.',
        'The board model is plain grid logic, tested on its own; the views animate the swaps and falls as presentation state.',
    ].join('\n\n'),
    instructions: [
        'Swap adjacent cactii to make',
        'a row or column of 3 or more',
        'matching species.',
        '',
        'Drag a cactus onto an adjacent',
        'one to swap them. Release to',
        'confirm the swap.',
        '',
        'Matched cactii are removed',
        'and new ones fall from above.',
        'Chain combos for bonus points!',
    ].join('\n'),
};
