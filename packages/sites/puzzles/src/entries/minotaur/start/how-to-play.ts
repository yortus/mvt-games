import type { HowToPlayText } from '../../../shared';

// ---------------------------------------------------------------------------
// How to play
// ---------------------------------------------------------------------------

/** How to play Minotaur, written once, for the card in the game and for the info panel. */
export const HOW_TO_PLAY: HowToPlayText = {
    rules: [
        'You\'re lost in a labyrinth on Crete, and you can\'t see its walls. To escape, lay Ariadne\'s thread from Α to Ω, '
        + 'through every cell once. The thread never branches, crosses itself or loops.',
        'Every side of a cell that the thread doesn\'t cross is a wall. The numbers are the lengths of wall along each line, '
        + 'in order, top to bottom and left to right.',
        'At Hard and Expert, a few lines show a single ? in place of their whole clue. Work those lines out from the cells '
        + 'and walls around them.',
    ],
    controls: [
        { action: 'Lay the thread', inputs: ['drag'], note: 'Drag from the middle of a cell' },
        { action: 'Draw walls', inputs: ['drag'], note: 'Drag from a corner along the lines' },
        { action: 'Rub out', inputs: ['drag'], note: 'Drag over a wall, or the thread, again' },
        { action: 'Undo', inputs: [{ button: 'Undo' }], note: 'Takes back the last thing you did' },
    ],
    notes: [
        'A clue fades once the walls on its line match it, and turns red if they can\'t. A cell is hatched in red if its marks '
        + 'break a rule.',
        'Your progress on every maze is kept in this browser.',
    ],
};
