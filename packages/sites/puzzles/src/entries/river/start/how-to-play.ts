import type { HowToPlayText } from '../../../shared';

// ---------------------------------------------------------------------------
// How to play
// ---------------------------------------------------------------------------

/** How to play River, written once, for the card in the game and for the info panel. */
export const HOW_TO_PLAY: HowToPlayText = {
    rules: [
        'Draw a river from the spring on the left to the sea at the bottom. It runs from cell to cell, straight on or '
        + 'turning a corner, and never crosses itself, splits or runs in a circle.',
        'The river winds, so it doesn\'t pass through every cell. The numbers say how many cells of each row and column it '
        + 'passes through.',
        'The pieces of river and the bushes printed in ink are given. Every puzzle can be solved from them by looking, '
        + 'without guessing.',
    ],
    controls: [
        { action: 'Draw the river', inputs: ['drag'], note: 'Drag from cell to cell. Drag along a river you drew to rub it out' },
        { action: 'Plant a flower', inputs: ['click', 'tap'], note: 'A flower is your note that the river keeps away from a cell. Tap again to take it off' },
        { action: 'Undo', inputs: [{ button: 'Undo' }], note: 'Takes back the last thing you did' },
    ],
    notes: [
        'A cell with the river turning three ways, a loop, and a river through a flower show in red. A number turns red '
        + 'when its line has too many river cells, or too little room left, and fades once it is met.',
        'Your progress on every puzzle is kept in this browser.',
    ],
};
