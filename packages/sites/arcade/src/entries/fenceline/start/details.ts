import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Fenceline's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: 'A territory game. You are a farmhand fencing off a wild meadow. String wire across it from fence to '
        + 'fence, and the part with no dust devil in it turns to pasture. Pen the sheep as you go, and corner a '
        + 'dust devil in a small paddock to blow it out.',
    implementation: 'The meadow is a grid model of cells, with fences along the lines between them. Tying off a wire runs '
        + 'one flood fill, and the views redraw the pasture and fences only as that happens.',
    howToPlay: {
        intro: 'Fence off the round\'s share of the meadow to clear it.',
        controls: [
            { action: 'Move', inputs: ['arrows', 'wasd', 'swipe'] },
            { action: 'Stop', inputs: ['tap'] },
            { action: 'Restart', inputs: ['enter'] },
        ],
        notes: [
            'Walk the fences. Push off one into the meadow to string wire, and reach another fence to tie it off.',
            'Keep your wire clear of dust devils, and keep moving: wire left standing goes slack and snaps. Beetles on the fences bite.',
        ],
    },
};
