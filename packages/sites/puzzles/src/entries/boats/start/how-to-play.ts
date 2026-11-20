import type { HowToPlayText } from '../../../shared';

// ---------------------------------------------------------------------------
// How to play
// ---------------------------------------------------------------------------

/** How to play Boats, written once, for the card in the game and for the info panel. */
export const HOW_TO_PLAY: HowToPlayText = {
    rules: [
        'Moor every boat of the fleet in the harbour. Each boat is a straight line of cells, across or down, from a dinghy '
        + 'of one cell to a ferry of four.',
        'Boats never touch, not even diagonally. The numbers say how many cells of each row and column hold part of a '
        + 'boat.',
        'The water and boat pieces printed in navy are given. A piece shows which way its boat runs. Every puzzle can be '
        + 'solved from them by looking, without guessing.',
    ],
    controls: [
        { action: 'Mark water', inputs: ['click', 'tap'], note: 'Water is your note that a cell doesn\'t hold a boat' },
        { action: 'Mark a boat', inputs: ['click', 'tap'], note: 'Tap a cell twice. A third tap clears it' },
        { action: 'Mark a line', inputs: ['drag'], note: 'Marks each cell like a tap on the first' },
        { action: 'Undo', inputs: [{ button: 'Undo' }], note: 'Takes back the last thing you did' },
    ],
    notes: [
        'Boats that touch, and a boat longer than any in the fleet, show in red. A number turns red when its row or column '
        + 'has too many boat cells, or too few cells left for its boats. It fades once its boats are all marked.',
        'A boat with water marked past both ends is finished, and the fleet under the harbour colours it in.',
        'Your progress on every puzzle is kept in this browser.',
    ],
};
