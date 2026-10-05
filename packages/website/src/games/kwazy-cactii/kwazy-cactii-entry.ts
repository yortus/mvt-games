import type { ArcadeEntry } from '../../entries';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Kwazy Cactii, as the arcade lists it. Its code loads on launch, from `kwazy-cactii-starter.ts`. */
export const kwazyCactiiEntry: ArcadeEntry = {
    id: 'kwazy-cactii',
    name: 'Kwazy Cactii',
    summary: 'Swap neighbouring cactii to line up three or more of a kind, and chain the cascades for bonus points.',
    description: [
        'A match-three puzzle. Drag a cactus onto its neighbour to swap them; a row or column of three or '
        + 'more of a kind clears, and the cactii above fall to fill the gap, sometimes setting off more.',
        'The board model is plain grid logic, tested on its own; the views animate the swaps and falls as presentation state.',
    ].join('\n\n'),
    tags: { kind: 'game', era: '2000s', genres: ['puzzle'] },
    screenWidth: 1600,
    screenHeight: 2180,
    thumbnail,
    // The colour of its cactii
    cardColor: 'mint',
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
    load: async () => (await import('./kwazy-cactii-starter')).loadKwazyCactiiStarter(),
};
