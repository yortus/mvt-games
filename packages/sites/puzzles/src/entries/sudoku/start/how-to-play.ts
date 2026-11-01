import type { HowToPlayText } from '../../../shared';

// ---------------------------------------------------------------------------
// How to play
// ---------------------------------------------------------------------------

/** How to play Sudoku, written once, for the card in the game and for the info panel. */
export const HOW_TO_PLAY: HowToPlayText = {
    rules: [
        'Fill every empty cell with a digit from 1 to 9, so that each row, each column and each 3 by 3 box holds every digit once.',
        'Each puzzle has only one answer. Notes help you work it out: pencil in what could go where.',
    ],
    controls: [
        { action: 'Pencil marks', inputs: ['tap'], note: 'Tap a cell, then the digits on the keypad' },
        { action: 'Link cells', inputs: ['drag'], note: 'Drag across cells, then the digits they hold between them' },
        { action: 'Fill in a cell', inputs: ['hold'], note: 'Tap the cell, then press and hold its digit on the keypad' },
        { action: 'Change or clear', inputs: ['hold'], note: 'Tap the cell, then hold another digit, or its own' },
        { action: 'Undo', inputs: [{ button: 'Undo' }], note: 'Takes back the last thing you did' },
    ],
    notes: [
        'Tap a linked note\'s label to select its cells again. Tap one of several cells selected to leave it out.',
        'Your progress on every puzzle is kept in this browser.',
    ],
};
