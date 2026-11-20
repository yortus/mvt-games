import type { HowToPlayText } from '../../../shared';

// ---------------------------------------------------------------------------
// How to play
// ---------------------------------------------------------------------------

/** How to play Boats, written once, for the card in the game and for the info panel. */
export const HOW_TO_PLAY: HowToPlayText = {
    rules: [
        'Moor every boat of the fleet in the harbour. Each boat is a straight line of cells, across or down, from a dinghy '
        + 'of one cell to a ferry of four or more.',
        'Boats never touch, not even diagonally. The numbers say how many cells of each row and column hold part of a '
        + 'boat.',
        'The water and boat pieces printed in navy are given. A piece says which way its boat goes on. Every puzzle can be '
        + 'solved from them by looking, without guessing.',
    ],
    controls: [
        { action: 'Mark water', inputs: ['click', 'tap'], note: 'Water is your note that a cell doesn\'t hold a boat' },
        { action: 'Mark a boat', inputs: ['click', 'tap'], note: 'Tap a cell twice. A third tap clears it' },
        { action: 'Mark a row', inputs: ['drag'], note: 'Drag to mark each cell as a tap marks the first' },
        { action: 'Undo', inputs: [{ button: 'Undo' }], note: 'Takes back the last thing you did' },
    ],
    notes: [
        'Boats that touch, and a boat longer than any in the fleet, show in red. A number turns red when its line has too '
        + 'many boat cells, or too little room left, and fades once it is met.',
        'A boat with water marked past both ends is finished, and the fleet under the harbour colours it in.',
        'Your progress on every puzzle is kept in this browser.',
    ],
};
