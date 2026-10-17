import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** The reordering-lists demo's long text, for its info panel, the pause menu and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'One row of cards, held two ways and rendered by the same index-addressed <List>. A script sorts, moves, '
        + 'inserts and removes cards in both at once, and a tap moves a card to the front.',
        'Both rows slide on a reorder, because each keeps its cards\' presentation state where it follows the card: '
        + 'per card id for the plain array, per storage slot for the OrderedSlotList. Only the OrderedSlotList '
        + 'row can animate a removal, because a removed card keeps its slot for a release delay.',
    ].join('\n\n'),
    techniques: [
        'Index-addressed <List> with no reconciliation: a reorder does no structural work',
        'Plain array: presentation state keyed by dense card id, republished per index',
        'OrderedSlotList: presentation state keyed by storage slot, position from slot.ordinal',
        'Exit effects via releaseDelayMs while the removed card\'s slot lingers',
        'All motion is view-side presentation state; the model is instantaneous',
    ],
};
