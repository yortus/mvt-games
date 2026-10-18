import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Fractal Forest's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'Each tree is a fractal: every branch splits in two by the same rule, all the way out to its sharp-edged leaves. '
        + 'Each spring brings new trees with new rules, near and far, the far ones softened by haze.',
        'The model plans every tree as the year begins, and works out each branch\'s growth and each leaf\'s colour and fall '
        + 'from the time of year. The view only draws them, bending the near trees with a wind it works out from the same time.',
    ].join('\n\n'),
};
