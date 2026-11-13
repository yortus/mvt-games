import type { HowToPlayText } from '../../../shared';

// ---------------------------------------------------------------------------
// How to play
// ---------------------------------------------------------------------------

/** How to play Stars, written once, for the card in the game and for the info panel. */
export const HOW_TO_PLAY: HowToPlayText = {
    rules: [
        'Place two stars in every row, every column and every region. The regions are the shapes drawn with thick lines.',
        'No two stars may touch, not even at a corner. Every other cell is empty.',
    ],
    controls: [
        { action: 'Put a dot in a cell', inputs: ['click', 'tap'], note: 'A dot is your note that a cell has no star' },
        { action: 'Place a star', inputs: ['click', 'tap'], note: 'Tap a cell twice. A third tap clears it' },
        { action: 'Dot many cells', inputs: ['drag'], note: 'Drag across them. A drag that starts on a dot rubs dots out' },
        { action: 'Undo', inputs: [{ button: 'Undo' }], note: 'Takes back the last thing you did' },
    ],
    notes: [
        'Stars that touch, and the stars of a row, column or region with more than two, show in red.',
        'Your progress on every puzzle is kept in this browser.',
    ],
};
