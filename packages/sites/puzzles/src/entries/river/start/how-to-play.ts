import type { HowToPlayText } from '../../../shared';

// ---------------------------------------------------------------------------
// How to play
// ---------------------------------------------------------------------------

/** How to play River, written once, for the card in the game and for the info panel. */
export const HOW_TO_PLAY: HowToPlayText = {
    rules: [
        'Draw a river from the spring on the left to the sea at the bottom. It runs from cell to cell, straight on or '
        + 'turning a corner, and never crosses itself, splits or runs in a circle.',
        'The river doesn\'t pass through every cell. The numbers say how many cells of each row and column it passes '
        + 'through.',
        'The pieces of river and the bushes printed in ink are part of the answer. You can solve every puzzle from them '
        + 'without guessing.',
    ],
    controls: [
        { action: 'Draw the river', inputs: ['drag'], note: 'Drag from cell to cell. Drag along a river you drew to rub it out' },
        { action: 'Plant a flower', inputs: ['click', 'tap'], note: 'A flower marks a cell the river doesn\'t pass through. Tap again to remove it' },
        { action: 'Undo', inputs: [{ button: 'Undo' }], note: 'Takes back the last thing you did' },
    ],
    notes: [
        'A cell turns red if the river branches there, loops through it, or runs through a flower. A number turns red '
        + 'when its line has too many river cells, or too few open cells left to reach it. It fades once it\'s met.',
        'Your progress on every puzzle is kept in this browser.',
    ],
};
