import type { HowToPlayText } from '../../../shared';

// ---------------------------------------------------------------------------
// How to play
// ---------------------------------------------------------------------------

/** How to play Stars, written once, for the card in the game and for the info panel. */
export const HOW_TO_PLAY: HowToPlayText = {
    rules: [
        'Place stars so that every row, every column and every region holds exactly two. The regions are the shapes drawn '
        + 'with thick lines.',
        'No two stars may touch, not even diagonally. Every other cell is empty.',
        'The stars and crosses printed in black are given. Every puzzle can be solved from them by looking, with no guessing.',
    ],
    controls: [
        { action: 'Put a cross in a cell', inputs: ['click', 'tap'], note: 'A cross is your note that a cell has no star' },
        { action: 'Place a star', inputs: ['click', 'tap'], note: 'Tap a cell twice. A third tap clears it' },
        { action: 'Ring a group', inputs: ['drag'], note: 'Drag across cells side by side: your note that a star is in one of them. Rings can\'t overlap. Drag again to take it off' },
        { action: 'Undo', inputs: [{ button: 'Undo' }], note: 'Takes back the last thing you did' },
    ],
    notes: [
        'Stars that touch, and the stars of a row, column or region with too many, show in red.',
        'A ring fades once a star is in it, and turns red if every cell in it has a cross.',
        'Your progress on every puzzle is kept in this browser.',
    ],
};
