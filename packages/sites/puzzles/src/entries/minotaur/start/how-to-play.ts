import type { HowToPlayText } from '../../../shared';

// ---------------------------------------------------------------------------
// How to play
// ---------------------------------------------------------------------------

/** How to play Minotaur, written once, for the card in the game and for the info panel. */
export const HOW_TO_PLAY: HowToPlayText = {
    rules: [
        'Build the maze. Draw one path from S to E that passes through every cell once, with no branches, crossings or loops.',
        'Every side of a cell the path doesn\'t cross is a wall. The numbers are the lengths of wall along each line, in order, '
        + 'top to bottom and left to right, with at least one gap between them.',
    ],
    controls: [
        { action: 'Draw the path', inputs: ['drag'], note: 'Start in the middle of a cell, and drag through the cells' },
        { action: 'Draw walls', inputs: ['drag'], note: 'Start at a corner, and drag along the lines' },
        { action: 'Rub out', inputs: ['drag'], note: 'Drag over a wall, or the path, again' },
        { action: 'Undo', inputs: [{ button: 'Undo' }], note: 'Takes back the last thing you did' },
    ],
    notes: [
        'A clue fades once the walls on its line match it, and turns red if they can\'t. A cell turns red if its marks break a rule.',
        'Your progress on every maze is kept in this browser.',
    ],
};
