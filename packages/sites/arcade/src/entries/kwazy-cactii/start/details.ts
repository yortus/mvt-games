import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Kwazy Cactii's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: 'A match-three puzzle. Drag a cactus onto its neighbour to swap them; a row or column of three or '
        + 'more of a kind clears, and the cactii above fall to fill the gap, sometimes setting off more.',
    implementation: 'The board model is plain grid logic, tested on its own; the views animate the swaps and falls as presentation state.',
    howToPlay: {
        intro: 'Swap adjacent cactii to make a row or column of 3 or more matching species.',
        controls: [
            { action: 'Swap', inputs: ['drag'], note: 'Drag a cactus onto an adjacent one, and release to confirm' },
        ],
        notes: ['Matched cactii are removed and new ones fall from above. Chain combos for bonus points!'],
    },
};
